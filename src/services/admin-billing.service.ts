import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { BillingFrequency, InvoiceKind, PaymentStatus, SubscriptionStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { Admin } from 'src/schemas/admin.schema';
import { AuditEntry } from 'src/schemas/audit-entry.schema';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { User } from 'src/schemas/user.schema';
import { paged } from 'src/utils/paging';
import { literalPattern } from 'src/utils/transaction-query';
import { AdminAuditService } from './admin-audit.service';
import { InvoiceService } from './invoice.service';

/// An invoice in the console's lists.
export type AdminInvoiceRow = {
  id: string;
  invoiceNumber: string;
  userId: string;
  userName: string;
  planTitle: string | null;
  billingFrequency: BillingFrequency | null;
  kind: InvoiceKind;
  description: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  failureReason: string | null;
  dueDate: Date | null;
  datePaid: Date | null;
  paymentStartedAt: Date | null;
  createdAt: Date;
};

export type AdminInvoiceDetail = AdminInvoiceRow & {
  startDate: Date | null;
  endDate: Date | null;
  paymentReference: string | null;
  paymentReferences: string[];
  gateway: Invoice['gateway'];
  refundedAt: Date | null;
  refundNote: string | null;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    isActive: boolean;
    endDate: Date;
  } | null;
  history: Pick<AuditEntry, 'id' | 'adminName' | 'summary' | 'createdAt'>[];
};

export type AdminSubscriptionRow = {
  id: string;
  userId: string;
  userName: string;
  planTitle: string;
  billingFrequency: BillingFrequency;
  status: SubscriptionStatus;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  maxNumberOfTransactions: number;
};

type Page = { page: number; pageSize: number };
type Counted<T> = PagedResults<T> & { counts: Record<string, number> };

/// The tabs on each list, and what they hold.
const PAYMENT_TABS: Record<string, Record<string, unknown>> = {
  all: {},
  paid: { status: PaymentStatus.Completed },
  failed: { status: PaymentStatus.Failed },
  waiting: { status: PaymentStatus.Processing },
};
const INVOICE_TABS: Record<string, Record<string, unknown>> = {
  all: {},
  unpaid: { status: { $in: [PaymentStatus.Pending, PaymentStatus.Processing, PaymentStatus.Failed] } },
  paid: { status: PaymentStatus.Completed },
  cancelled: { status: PaymentStatus.Cancelled },
  refunded: { status: PaymentStatus.Refunded },
};
const SUBSCRIPTION_TABS: Record<string, Record<string, unknown>> = {
  running: { isActive: true },
  pending: { status: SubscriptionStatus.Pending },
  expired: { status: SubscriptionStatus.Expired },
  ended: { status: { $in: [SubscriptionStatus.Closed, SubscriptionStatus.Cancelled, SubscriptionStatus.Inactive] } },
};

/// The console's money pages. Payments are invoices someone has started to
/// pay; Invoices are all of them (free plans' GHS 0 ones left out).
@Injectable()
export class AdminBillingService {
  private readonly logger = new Logger(AdminBillingService.name);
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(AuditEntry.name)
    private readonly auditModel: Model<AuditEntry>,
    private readonly invoiceService: InvoiceService,
    private readonly audit: AdminAuditService,
  ) {}

  payments(tab: string, query: string | undefined, page: Page) {
    return this.invoiceList(
      { amount: { $gt: 0 }, paymentReference: { $ne: null } },
      PAYMENT_TABS,
      tab,
      query,
      page,
      { updatedAt: -1 },
    );
  }

  invoices(tab: string, query: string | undefined, page: Page) {
    return this.invoiceList({ amount: { $gt: 0 } }, INVOICE_TABS, tab, query, page, {
      createdAt: -1,
    });
  }

  async invoice(id: string): Promise<ApiResponseDto<AdminInvoiceDetail>> {
    try {
      const invoice = await this.invoiceModel.findOne({ id }).lean();
      if (!invoice) return CommonResponses.NotFoundResponse('Invoice not found');
      const [rows, subscription, history] = await Promise.all([
        this.rows([invoice]),
        this.subscriptionModel.findOne({ id: invoice.subscriptionId }).lean(),
        this.auditModel.find({ targetId: id }).sort({ createdAt: -1 }).limit(20).lean(),
      ]);
      return CommonResponses.OkResponse({
        ...rows[0],
        startDate: invoice.startDate ?? null,
        endDate: invoice.endDate ?? null,
        paymentReference: invoice.paymentReference ?? null,
        paymentReferences: invoice.paymentReferences ?? [],
        gateway: invoice.gateway ?? null,
        refundedAt: invoice.refundedAt ?? null,
        refundNote: invoice.refundNote ?? null,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              isActive: subscription.isActive,
              endDate: subscription.endDate,
            }
          : null,
        history: history.map((h) => ({
          id: h.id,
          adminName: h.adminName,
          summary: h.summary,
          createdAt: h.createdAt,
        })),
      });
    } catch (error) {
      this.logger.error('Error loading an invoice', { id }, error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  /// Asks Paystack about the invoice's latest checkout now.
  async recheck(admin: Admin, id: string): Promise<ApiResponseDto<AdminInvoiceDetail>> {
    const before = await this.invoiceModel.findOne({ id }).lean();
    if (!before) return CommonResponses.NotFoundResponse('Invoice not found');
    if (!before.paymentReference) {
      return CommonResponses.ConflictResponse("Nobody has started paying this invoice yet.");
    }
    const after = await this.invoiceService.recheck(id);
    await this.audit.record(
      admin,
      'invoice.recheck',
      { type: 'invoice', id },
      before.status === after?.status
        ? `Asked Paystack about ${before.invoiceNumber}: still ${label(before.status)}`
        : `Asked Paystack about ${before.invoiceNumber}: ${label(before.status)} → ${label(after.status)}`,
    );
    return this.invoice(id);
  }

  /// Records that a paid invoice was refunded. The money goes back in
  /// Paystack's dashboard; this keeps the console's records true.
  async markRefunded(admin: Admin, id: string, note?: string): Promise<ApiResponseDto<AdminInvoiceDetail>> {
    const invoice = await this.invoiceModel.findOne({ id }).lean();
    if (!invoice) return CommonResponses.NotFoundResponse('Invoice not found');
    if (invoice.status !== PaymentStatus.Completed) {
      return CommonResponses.ConflictResponse('Only a paid invoice can be marked refunded.');
    }
    const now = new Date();
    const updated = await this.invoiceModel.findOneAndUpdate(
      { id, status: PaymentStatus.Completed },
      {
        status: PaymentStatus.Refunded,
        refundedAt: now,
        refundNote: note?.trim() || null,
        updatedAt: now,
        updatedBy: admin.id,
      },
    );
    if (!updated) return CommonResponses.ConflictResponse('Only a paid invoice can be marked refunded.');
    await this.audit.record(
      admin,
      'invoice.refund',
      { type: 'invoice', id },
      `Marked ${invoice.invoiceNumber} (${invoice.currency ?? 'GHS'} ${invoice.amount.toFixed(2)}) refunded${note?.trim() ? `: ${note.trim()}` : ''}`,
    );
    return this.invoice(id);
  }

  async subscriptions(
    tab: string,
    query: string | undefined,
    page: Page,
  ): Promise<ApiResponseDto<Counted<AdminSubscriptionRow>>> {
    try {
      const base: Record<string, unknown> = {};
      const userIds = await this.userIdsMatching(query);
      if (userIds) base.userId = { $in: userIds };
      const filter = { ...base, ...(SUBSCRIPTION_TABS[tab] ?? SUBSCRIPTION_TABS.running) };
      const [result, counts] = await Promise.all([
        paged(this.subscriptionModel, filter, page, { updatedAt: -1, createdAt: -1 }),
        this.countTabs(this.subscriptionModel, base, SUBSCRIPTION_TABS),
      ]);
      const names = await this.namesOf(result.results.map((s) => s.userId));
      return CommonResponses.OkResponse({
        ...result,
        counts,
        results: result.results.map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: names.get(s.userId) ?? 'Deleted account',
          planTitle: s.planTitle,
          billingFrequency: s.billingFrequency,
          status: s.status,
          isActive: s.isActive,
          startDate: s.startDate,
          endDate: s.endDate,
          maxNumberOfTransactions: s.maxNumberOfTransactions,
        })),
      });
    } catch (error) {
      this.logger.error('Error listing subscriptions', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  private async invoiceList(
    scope: Record<string, unknown>,
    tabs: Record<string, Record<string, unknown>>,
    tab: string,
    query: string | undefined,
    page: Page,
    sort: Record<string, 1 | -1>,
  ): Promise<ApiResponseDto<Counted<AdminInvoiceRow>>> {
    try {
      const base: Record<string, unknown> = { ...scope };
      if (query?.trim()) {
        const userIds = (await this.userIdsMatching(query)) ?? [];
        base.$or = [
          { invoiceNumber: literalPattern(query.trim()) },
          { userId: { $in: userIds } },
        ];
      }
      const filter = { ...base, ...(tabs[tab] ?? {}) };
      const [result, counts] = await Promise.all([
        paged(this.invoiceModel, filter, page, sort),
        this.countTabs(this.invoiceModel, base, tabs),
      ]);
      return CommonResponses.OkResponse({
        ...result,
        counts,
        results: await this.rows(result.results),
      });
    } catch (error) {
      this.logger.error('Error listing invoices', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  private async rows(invoices: Invoice[]): Promise<AdminInvoiceRow[]> {
    const [names, subs] = await Promise.all([
      this.namesOf(invoices.map((i) => i.userId)),
      this.subscriptionModel
        .find({ id: { $in: invoices.map((i) => i.subscriptionId) } })
        .lean()
        .then((list) => new Map(list.map((s) => [s.id, s]))),
    ]);
    return invoices.map((i) => {
      const sub = subs.get(i.subscriptionId);
      return {
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        userId: i.userId,
        userName: names.get(i.userId) ?? 'Deleted account',
        planTitle: sub?.planTitle ?? null,
        billingFrequency: sub?.billingFrequency ?? null,
        kind: i.kind ?? InvoiceKind.New,
        description: i.description ?? null,
        amount: i.amount,
        currency: i.currency ?? 'GHS',
        status: i.status,
        paymentMethod: i.paymentMethod ?? null,
        failureReason: i.failureReason ?? null,
        dueDate: i.dueDate ?? null,
        datePaid: i.datePaid ?? null,
        paymentStartedAt: i.paymentStartedAt ?? null,
        createdAt: i.createdAt,
      };
    });
  }

  private async countTabs(
    model: Model<any>,
    base: Record<string, unknown>,
    tabs: Record<string, Record<string, unknown>>,
  ): Promise<Record<string, number>> {
    const entries = await Promise.all(
      Object.entries(tabs).map(async ([key, f]) => [key, await model.countDocuments({ ...base, ...f })] as const),
    );
    return Object.fromEntries(entries);
  }

  /// Ids of users whose name, email or phone match [query]; null without one.
  private async userIdsMatching(query?: string): Promise<string[] | null> {
    if (!query?.trim()) return null;
    const pattern = literalPattern(query.trim());
    const users = await this.userModel
      .find({ $or: [{ firstName: pattern }, { lastName: pattern }, { email: pattern }, { phoneNumber: pattern }] })
      .limit(500)
      .lean();
    return users.map((u) => u.id);
  }

  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const users = await this.userModel.find({ id: { $in: unique } }).lean();
    return new Map(
      users.map((u) => [
        u.id,
        `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.phoneNumber || u.email || 'No name',
      ]),
    );
  }
}

function label(status?: PaymentStatus | null): string {
  switch (status) {
    case PaymentStatus.Completed:
      return 'paid';
    case PaymentStatus.Processing:
      return 'waiting';
    default:
      return (status ?? 'unknown').toLowerCase();
  }
}
