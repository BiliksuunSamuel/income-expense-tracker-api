import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { SubscriptionStatus, UserStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { Account } from 'src/schemas/account.schema';
import { Admin } from 'src/schemas/admin.schema';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Budget } from 'src/schemas/budget.schema';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { Transaction } from 'src/schemas/transaction.schema';
import { User } from 'src/schemas/user.schema';
import { generateId } from 'src/utils';
import { paged } from 'src/utils/paging';
import { monthStart } from 'src/utils/subscription-invoice';
import { literalPattern } from 'src/utils/transaction-query';
import { AdminAuditService } from './admin-audit.service';

/// A user as the console lists them: who, how they sign in, their plan.
export type AdminUserRow = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  signIn: 'Google' | 'Phone' | 'Email';
  joinedAt: Date;
  status: UserStatus;
  planTitle: string | null;
  planEndsAt: Date | null;
};

/// One user: their account, plan and invoices, and counts of what they keep.
/// Never the entries, accounts or budgets themselves.
export type AdminUserDetail = AdminUserRow & {
  currency: string | null;
  subscription: {
    id: string;
    planTitle: string;
    billingFrequency: string;
    status: SubscriptionStatus;
    startDate: Date;
    endDate: Date;
    maxNumberOfTransactions: number;
  } | null;
  counts: {
    entriesThisMonth: number;
    entries: number;
    accounts: number;
    budgets: number;
  };
  invoices: Pick<
    Invoice,
    'id' | 'invoiceNumber' | 'description' | 'amount' | 'currency' | 'status' | 'kind' | 'datePaid' | 'dueDate' | 'createdAt'
  >[];
  paidTotal: number;
};

export type UserListQuery = {
  query?: string;
  status?: 'active' | 'suspended';
  plan?: 'paid' | 'free';
};

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
    @InjectModel(Budget.name) private readonly budgetModel: Model<Budget>,
    @InjectModel(BillingPlan.name)
    private readonly billingPlanModel: Model<BillingPlan>,
    private readonly audit: AdminAuditService,
  ) {}

  async list(
    q: UserListQuery,
    page: { page: number; pageSize: number },
  ): Promise<ApiResponseDto<PagedResults<AdminUserRow> & { counts: Record<string, number> }>> {
    try {
      const filter: Record<string, unknown> = {};
      if (typeof q.query === 'string' && q.query.trim()) {
        const pattern = literalPattern(q.query.trim());
        filter.$or = [
          { firstName: pattern },
          { lastName: pattern },
          { email: pattern },
          { phoneNumber: pattern },
        ];
      }
      if (q.status === 'suspended') filter.status = UserStatus.Inactive;
      if (q.status === 'active') filter.status = { $ne: UserStatus.Inactive };
      if (q.plan) {
        const paidUserIds = await this.paidUserIds();
        filter.id = q.plan === 'paid' ? { $in: paidUserIds } : { $nin: paidUserIds };
      }

      const base = { ...filter };
      delete base.status;
      const [result, all, suspended] = await Promise.all([
        paged(this.userModel, filter, page),
        this.userModel.countDocuments(base),
        this.userModel.countDocuments({ ...base, status: UserStatus.Inactive }),
      ]);
      const subs = await this.activeSubscriptions(result.results.map((u) => u.id));
      return CommonResponses.OkResponse({
        ...result,
        results: result.results.map((u) => this.row(u, subs.get(u.id))),
        counts: { all, active: all - suspended, suspended },
      });
    } catch (error) {
      this.logger.error('Error listing users', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  async detail(id: string, now = new Date()): Promise<ApiResponseDto<AdminUserDetail>> {
    try {
      const user = await this.userModel.findOne({ id }).lean();
      if (!user) return CommonResponses.NotFoundResponse('User not found');
      const [subscription, invoices, entriesThisMonth, entries, accounts, budgets] =
        await Promise.all([
          this.subscriptionModel.findOne({ userId: id, isActive: true }).lean(),
          this.invoiceModel.find({ userId: id }).sort({ createdAt: -1 }).limit(20).lean(),
          this.transactionModel.countDocuments({ userId: id, recordedAt: { $gte: monthStart(now) } }),
          this.transactionModel.countDocuments({ userId: id }),
          this.accountModel.countDocuments({ userId: id }),
          this.budgetModel.countDocuments({ createdBy: id }),
        ]);
      const paidTotal = invoices
        .filter((i) => i.status === 'Completed')
        .reduce((total, i) => total + (i.amount ?? 0), 0);
      return CommonResponses.OkResponse({
        ...this.row(user, subscription ?? undefined),
        currency: user.currency ?? null,
        subscription: subscription
          ? {
              id: subscription.id,
              planTitle: subscription.planTitle,
              billingFrequency: subscription.billingFrequency,
              status: subscription.status,
              startDate: subscription.startDate,
              endDate: subscription.endDate,
              maxNumberOfTransactions: subscription.maxNumberOfTransactions,
            }
          : null,
        counts: { entriesThisMonth, entries, accounts, budgets },
        invoices: invoices.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          description: i.description,
          amount: i.amount,
          currency: i.currency ?? 'GHS',
          status: i.status,
          kind: i.kind,
          datePaid: i.datePaid,
          dueDate: i.dueDate,
          createdAt: i.createdAt,
        })),
        paidTotal: Math.round(paidTotal * 100) / 100,
      });
    } catch (error) {
      this.logger.error('Error loading a user', { id }, error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  /// Stops [id] using the app: their sessions end now, and every request
  /// is refused until they're restored. Nothing of theirs is deleted.
  async suspend(admin: Admin, id: string, reason?: string): Promise<ApiResponseDto<AdminUserDetail>> {
    const user = await this.userModel.findOne({ id }).lean();
    if (!user) return CommonResponses.NotFoundResponse('User not found');
    if (user.status === UserStatus.Inactive) {
      return CommonResponses.ConflictResponse('This account is already suspended.');
    }
    await this.userModel.updateOne(
      { id },
      { status: UserStatus.Inactive, tokenId: generateId(), updatedAt: new Date(), updatedBy: admin.id },
    );
    await this.audit.record(
      admin,
      'user.suspend',
      { type: 'user', id },
      `Suspended ${this.nameOf(user)}${reason?.trim() ? `: ${reason.trim()}` : ''}`,
    );
    return this.detail(id);
  }

  async restore(admin: Admin, id: string): Promise<ApiResponseDto<AdminUserDetail>> {
    const user = await this.userModel.findOne({ id }).lean();
    if (!user) return CommonResponses.NotFoundResponse('User not found');
    if (user.status !== UserStatus.Inactive) {
      return CommonResponses.ConflictResponse("This account isn't suspended.");
    }
    await this.userModel.updateOne(
      { id },
      { status: UserStatus.Active, updatedAt: new Date(), updatedBy: admin.id },
    );
    await this.audit.record(admin, 'user.restore', { type: 'user', id }, `Restored ${this.nameOf(user)}`);
    return this.detail(id);
  }

  private row(user: User, subscription?: Subscription): AdminUserRow {
    return {
      id: user.id,
      name: this.nameOf(user),
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      signIn: user.isGoogleAuth ? 'Google' : user.phoneNumber ? 'Phone' : 'Email',
      joinedAt: user.createdAt,
      status: user.status === UserStatus.Inactive ? UserStatus.Inactive : UserStatus.Active,
      planTitle: subscription?.planTitle ?? null,
      planEndsAt: subscription?.endDate ?? null,
    };
  }

  private nameOf(user: User): string {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phoneNumber || user.email || 'No name';
  }

  private async activeSubscriptions(userIds: string[]): Promise<Map<string, Subscription>> {
    if (!userIds.length) return new Map();
    const subs = await this.subscriptionModel
      .find({ userId: { $in: userIds }, isActive: true })
      .lean();
    return new Map(subs.map((s) => [s.userId, s]));
  }

  /// Users whose running plan costs money.
  private async paidUserIds(): Promise<string[]> {
    const paidPlanIds = (
      await this.billingPlanModel.find({ price: { $gt: 0 } }).lean()
    ).map((p) => p.id);
    const subs = await this.subscriptionModel
      .find({
        isActive: true,
        status: SubscriptionStatus.Active,
        billingPlanId: { $in: paidPlanIds },
      })
      .lean();
    return [...new Set(subs.map((s) => s.userId))];
  }
}
