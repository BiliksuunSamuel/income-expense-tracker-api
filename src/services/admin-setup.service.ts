import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { AdminRole, AdminStatus, BillingPlanType, SubscriptionStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { Admin } from 'src/schemas/admin.schema';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { calculateYearlyPrice, formatPhoneNumber, generateId } from 'src/utils';
import { AdminAuditService } from './admin-audit.service';

export type AdminPlanRow = BillingPlan & { yearlyPrice: number; subscribers: number };

export type PlanRequest = Partial<
  Pick<
    BillingPlan,
    'title' | 'description' | 'price' | 'yearlyDiscount' | 'features' | 'unavailableFeatures' | 'maxNumberOfTransactions'
  >
>;

export type AdminRow = Pick<
  Admin,
  'id' | 'phoneNumber' | 'firstName' | 'lastName' | 'role' | 'status' | 'createdAt' | 'lastSignedInAt'
>;

export type AdminRequest = Partial<Pick<Admin, 'phoneNumber' | 'firstName' | 'lastName' | 'role' | 'status'>>;

/// The console's Setup pages: billing plans and who can sign in. Changes
/// are for Owners and go in the audit log.
@Injectable()
export class AdminSetupService {
  private readonly logger = new Logger(AdminSetupService.name);
  constructor(
    @InjectModel(BillingPlan.name)
    private readonly billingPlanModel: Model<BillingPlan>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
    private readonly audit: AdminAuditService,
  ) {}

  // ── Billing plans ─────────────────────────────────────────────────────

  async plans(): Promise<ApiResponseDto<AdminPlanRow[]>> {
    try {
      const plans = await this.billingPlanModel.find({}).lean();
      const counts = await Promise.all(
        plans.map((p) =>
          this.subscriptionModel.countDocuments({
            billingPlanId: p.id,
            isActive: true,
            status: SubscriptionStatus.Active,
          }),
        ),
      );
      return CommonResponses.OkResponse(
        plans
          .map((p, i) => ({ ...calculateYearlyPrice({ ...p }), subscribers: counts[i] }) as AdminPlanRow)
          .sort((a, b) => a.price - b.price),
      );
    } catch (error) {
      this.logger.error('Error listing plans', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  async createPlan(admin: Admin, request: PlanRequest): Promise<ApiResponseDto<BillingPlan>> {
    const problem = planProblem(request, true);
    if (problem) return CommonResponses.BadRequestResponse(null, problem);
    if (await this.billingPlanModel.findOne({ title: request.title }).lean()) {
      return CommonResponses.ConflictResponse(`There's already a ${request.title} plan.`);
    }
    const now = new Date();
    const doc = await this.billingPlanModel.create({
      id: generateId(),
      createdAt: now,
      createdBy: admin.id,
      title: request.title,
      description: request.description?.trim() ?? '',
      price: request.price,
      yearlyDiscount: request.yearlyDiscount ?? 0,
      features: clean(request.features),
      unavailableFeatures: clean(request.unavailableFeatures),
      maxNumberOfTransactions: request.maxNumberOfTransactions ?? 0,
    });
    const plan = doc.toObject();
    await this.audit.record(admin, 'plan.create', { type: 'plan', id: plan.id }, `Added the ${plan.title} plan at GHS ${plan.price.toFixed(2)} a month`);
    return CommonResponses.CreatedResponse(calculateYearlyPrice(plan), 'Plan added');
  }

  /// A new price applies from each subscriber's next invoice; a new entry
  /// limit applies to everyone on the plan straight away.
  async updatePlan(admin: Admin, id: string, request: PlanRequest): Promise<ApiResponseDto<BillingPlan>> {
    const plan = await this.billingPlanModel.findOne({ id }).lean();
    if (!plan) return CommonResponses.NotFoundResponse('Plan not found');
    const problem = planProblem(request, false);
    if (problem) return CommonResponses.BadRequestResponse(null, problem);
    if (plan.price <= 0 && request.price !== undefined && request.price > 0) {
      return CommonResponses.BadRequestResponse(null, 'The free plan stays free: everyone falls back to it.');
    }

    const changes: Partial<BillingPlan> = {};
    if (request.description !== undefined) changes.description = request.description.trim();
    if (request.price !== undefined) changes.price = request.price;
    if (request.yearlyDiscount !== undefined) changes.yearlyDiscount = request.yearlyDiscount;
    if (request.features !== undefined) changes.features = clean(request.features);
    if (request.unavailableFeatures !== undefined) changes.unavailableFeatures = clean(request.unavailableFeatures);
    if (request.maxNumberOfTransactions !== undefined) changes.maxNumberOfTransactions = request.maxNumberOfTransactions;
    // What changed, worked out before saving.
    const said: string[] = [];
    if (changes.price !== undefined && changes.price !== plan.price) said.push(`price GHS ${plan.price.toFixed(2)} → ${changes.price.toFixed(2)}`);
    if (changes.yearlyDiscount !== undefined && changes.yearlyDiscount !== plan.yearlyDiscount) said.push(`yearly discount ${plan.yearlyDiscount}% → ${changes.yearlyDiscount}%`);
    if (changes.maxNumberOfTransactions !== undefined && changes.maxNumberOfTransactions !== plan.maxNumberOfTransactions) said.push(`entries a month ${plan.maxNumberOfTransactions} → ${changes.maxNumberOfTransactions}`);
    if (changes.description !== undefined && changes.description !== plan.description) said.push('description');
    if (changes.features !== undefined || changes.unavailableFeatures !== undefined) said.push('features');
    const limitChanged =
      changes.maxNumberOfTransactions !== undefined &&
      changes.maxNumberOfTransactions !== plan.maxNumberOfTransactions;
    const updated = await this.billingPlanModel
      .findOneAndUpdate({ id }, { ...changes, updatedAt: new Date(), updatedBy: admin.id }, { new: true })
      .lean();

    if (limitChanged) {
      await this.subscriptionModel.updateMany(
        { billingPlanId: id, isActive: true },
        { maxNumberOfTransactions: changes.maxNumberOfTransactions },
      );
    }
    await this.audit.record(admin, 'plan.update', { type: 'plan', id }, `Changed the ${plan.title} plan${said.length ? `: ${said.join(', ')}` : ''}`);
    return CommonResponses.OkResponse(calculateYearlyPrice(updated), 'Plan saved');
  }

  // ── Admins ────────────────────────────────────────────────────────────

  async admins(): Promise<ApiResponseDto<AdminRow[]>> {
    const admins = await this.adminModel.find({}).sort({ createdAt: 1 }).lean();
    return CommonResponses.OkResponse(admins.map(adminRow));
  }

  async addAdmin(by: Admin, request: AdminRequest): Promise<ApiResponseDto<AdminRow>> {
    const phone = parsePhone(request.phoneNumber);
    if (!phone) return CommonResponses.BadRequestResponse(null, 'Enter a valid phone number.');
    if (!request.firstName?.trim()) return CommonResponses.BadRequestResponse(null, 'Enter their first name.');
    const role = request.role === AdminRole.Owner ? AdminRole.Owner : AdminRole.Admin;
    if (await this.adminModel.findOne({ phoneNumber: phone }).lean()) {
      return CommonResponses.ConflictResponse('That number can already sign in.');
    }
    const doc = await this.adminModel.create({
      id: generateId(),
      createdAt: new Date(),
      createdBy: by.id,
      phoneNumber: phone,
      firstName: request.firstName.trim(),
      lastName: request.lastName?.trim() ?? '',
      role,
      status: AdminStatus.Active,
    });
    const admin = doc.toObject();
    await this.audit.record(by, 'admin.add', { type: 'admin', id: admin.id }, `Added ${AdminAuditService.nameOf(admin)} as ${role}`);
    return CommonResponses.CreatedResponse(adminRow(admin), 'Admin added');
  }

  /// Changes a name, role or status. Nobody can demote or suspend
  /// themselves, and there's always an active Owner.
  async updateAdmin(by: Admin, id: string, request: AdminRequest): Promise<ApiResponseDto<AdminRow>> {
    const admin = await this.adminModel.findOne({ id }).lean();
    if (!admin) return CommonResponses.NotFoundResponse('Admin not found');
    const role = request.role ?? admin.role;
    const status = request.status ?? admin.status;
    if (!Object.values(AdminRole).includes(role) || !Object.values(AdminStatus).includes(status)) {
      return CommonResponses.BadRequestResponse(null, 'Choose a role and status from the list.');
    }
    if (id === by.id && (role !== admin.role || status !== admin.status)) {
      return CommonResponses.ForbiddenResponse("You can't change your own role or suspend yourself.");
    }
    const losingOwner =
      admin.role === AdminRole.Owner &&
      admin.status === AdminStatus.Active &&
      (role !== AdminRole.Owner || status !== AdminStatus.Active);
    if (losingOwner) {
      const owners = await this.adminModel.countDocuments({ role: AdminRole.Owner, status: AdminStatus.Active });
      if (owners <= 1) return CommonResponses.ConflictResponse('There must always be an active Owner.');
    }

    const changes: Partial<Admin> = { role, status, updatedAt: new Date(), updatedBy: by.id };
    if (request.firstName !== undefined) changes.firstName = request.firstName.trim();
    if (request.lastName !== undefined) changes.lastName = request.lastName.trim();
    // A suspended admin's session ends now.
    if (status === AdminStatus.Suspended) changes.sessionId = null;
    const updated = await this.adminModel.findOneAndUpdate({ id }, changes, { new: true }).lean();

    const said: string[] = [];
    if (role !== admin.role) said.push(`role ${admin.role} → ${role}`);
    if (status !== admin.status) said.push(status === AdminStatus.Suspended ? 'suspended' : 'restored');
    if (changes.firstName !== undefined || changes.lastName !== undefined) said.push('name');
    await this.audit.record(by, 'admin.update', { type: 'admin', id }, `Changed ${AdminAuditService.nameOf(admin)}${said.length ? `: ${said.join(', ')}` : ''}`);
    return CommonResponses.OkResponse(adminRow(updated), 'Saved');
  }
}

function adminRow(a: Admin): AdminRow {
  return {
    id: a.id,
    phoneNumber: a.phoneNumber,
    firstName: a.firstName,
    lastName: a.lastName,
    role: a.role,
    status: a.status,
    createdAt: a.createdAt,
    lastSignedInAt: a.lastSignedInAt ?? null,
  };
}

/// What's wrong with [request], or null. [creating] needs every field.
function planProblem(request: PlanRequest, creating: boolean): string | null {
  if (creating && !Object.values(BillingPlanType).includes(request.title as BillingPlanType)) {
    return `Choose a plan name: ${Object.values(BillingPlanType).join(', ')}.`;
  }
  const money = (n: unknown) => typeof n === 'number' && isFinite(n) && n >= 0 && Math.round(n * 100) === n * 100;
  if ((creating || request.price !== undefined) && !money(request.price)) {
    return 'Enter the monthly price in cedis, e.g. 20 or 19.99.';
  }
  if (request.yearlyDiscount !== undefined && !(Number.isInteger(request.yearlyDiscount) && request.yearlyDiscount >= 0 && request.yearlyDiscount <= 90)) {
    return 'The yearly discount is a whole percentage, 0 to 90.';
  }
  if (request.maxNumberOfTransactions !== undefined && !(Number.isInteger(request.maxNumberOfTransactions) && request.maxNumberOfTransactions >= 0)) {
    return 'Entries a month is a whole number (0 means no limit).';
  }
  for (const list of [request.features, request.unavailableFeatures]) {
    if (list !== undefined && (!Array.isArray(list) || list.some((f) => typeof f !== 'string'))) {
      return 'Features are a list of lines of text.';
    }
  }
  return null;
}

const clean = (list?: string[]) => (list ?? []).map((f) => f.trim()).filter(Boolean);

function parsePhone(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const { isValid, validNumber } = formatPhoneNumber(raw.trim());
    return isValid ? validNumber : null;
  } catch {
    return null;
  }
}
