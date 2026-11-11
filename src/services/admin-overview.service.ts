import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import {
  BillingFrequency,
  InvoiceKind,
  PaymentStatus,
  SubscriptionStatus,
} from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { Transaction } from 'src/schemas/transaction.schema';
import { User } from 'src/schemas/user.schema';
import { calculateYearlyPrice } from 'src/utils';
import { daysFromNow, monthStart, roundCedis } from 'src/utils/subscription-invoice';

/// Something an admin should act on, with how many and who.
export type AttentionItem = {
  kind: 'failed_payments' | 'waiting_payments' | 'overdue_renewals';
  count: number;
  /// Up to three names, for the line under it.
  names: string[];
};

export type RecentPayment = {
  id: string;
  invoiceNumber: string;
  userName: string;
  planTitle: string | null;
  billingFrequency: BillingFrequency | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  failureReason: string | null;
  at: Date;
};

/// The console's first page. Counts and billing only: nothing about what
/// people record.
export type AdminOverview = {
  /// When these figures were worked out; "this month" is this date's month.
  asOf: Date;
  users: number;
  paidUsers: number;
  /// Cedis paid this calendar month, and last month for comparison.
  revenue: {
    thisMonth: number;
    lastMonth: number;
    monthlyPlans: number;
    yearlyPlans: number;
  };
  newPaidThisMonth: number;
  signups: { thisMonth: number; google: number };
  renewalsDueNext7Days: number;
  attention: AttentionItem[];
  recentPayments: RecentPayment[];
} & OverviewTrends;

/// How things are moving: the charts and the second row of figures.
export type OverviewTrends = {
  /// Cedis paid each day for the last 30 days (UTC, Ghana's time), oldest first.
  revenueByDay: { date: string; amount: number }[];
  /// Cedis paid each month for the last 12 months, oldest first.
  revenueByMonth: { month: string; amount: number }[];
  /// Sign-ups each day for the last 30 days, by how they signed in.
  signupsByDay: { date: string; google: number; phone: number }[];
  /// People who added at least one entry: today, in the last 7 days, this month.
  active: { today: number; week: number; month: number };
  /// What running plans bring in a month (yearly plans counted as a twelfth),
  /// and how many people are on each plan.
  recurring: { monthly: number; plans: { title: string; count: number }[] };
  /// People on the free plan who've used 80% or more of this month's entries.
  nearLimit: { count: number; limit: number; people: { id: string; name: string; used: number }[] };
};

const OPEN = [PaymentStatus.Pending, PaymentStatus.Processing, PaymentStatus.Failed];
/// A checkout still waiting after this long is worth a look.
const WAITING_AFTER_MS = 30 * 60 * 1000;

@Injectable()
export class AdminOverviewService {
  private readonly logger = new Logger(AdminOverviewService.name);
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(BillingPlan.name)
    private readonly billingPlanModel: Model<BillingPlan>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async overview(now = new Date()): Promise<ApiResponseDto<AdminOverview>> {
    try {
      const thisMonth = monthStart(now);
      const lastMonth = monthStart(new Date(thisMonth.getTime() - 1));
      const paidPlanIds = (
        await this.billingPlanModel.find({ price: { $gt: 0 } }).lean()
      ).map((p) => p.id);
      const runningPaid = {
        isActive: true,
        status: SubscriptionStatus.Active,
        billingPlanId: { $in: paidPlanIds },
      };

      const [
        users,
        paidUsers,
        signupsThisMonth,
        googleThisMonth,
        paidThisMonth,
        paidLastMonth,
        newPaidThisMonth,
        renewalsDueNext7Days,
        failed,
        waiting,
        overdue,
        recent,
      ] = await Promise.all([
        this.userModel.countDocuments({}),
        this.subscriptionModel.countDocuments(runningPaid),
        this.userModel.countDocuments({ createdAt: { $gte: thisMonth } }),
        this.userModel.countDocuments({
          createdAt: { $gte: thisMonth },
          isGoogleAuth: true,
        }),
        this.invoiceModel
          .find({
            status: PaymentStatus.Completed,
            amount: { $gt: 0 },
            datePaid: { $gte: thisMonth, $lte: now },
          })
          .lean(),
        this.invoiceModel
          .find({
            status: PaymentStatus.Completed,
            amount: { $gt: 0 },
            datePaid: { $gte: lastMonth, $lt: thisMonth },
          })
          .lean(),
        this.invoiceModel.countDocuments({
          status: PaymentStatus.Completed,
          kind: InvoiceKind.New,
          amount: { $gt: 0 },
          datePaid: { $gte: thisMonth },
        }),
        this.invoiceModel.countDocuments({
          kind: InvoiceKind.Renewal,
          status: { $in: OPEN },
          dueDate: { $lte: daysFromNow(7, now) },
        }),
        this.invoiceModel
          .find({
            status: PaymentStatus.Failed,
            updatedAt: { $gte: daysFromNow(-1, now) },
          })
          .lean(),
        this.invoiceModel
          .find({
            status: PaymentStatus.Processing,
            paymentStartedAt: {
              $lte: new Date(now.getTime() - WAITING_AFTER_MS),
              $gte: daysFromNow(-2, now),
            },
          })
          .lean(),
        this.subscriptionModel
          .find({ ...runningPaid, endDate: { $lt: now } })
          .lean(),
        this.invoiceModel
          .find({
            status: {
              $in: [
                PaymentStatus.Completed,
                PaymentStatus.Failed,
                PaymentStatus.Processing,
              ],
            },
            amount: { $gt: 0 },
          })
          .sort({ updatedAt: -1 })
          .limit(8)
          .lean(),
      ]);

      const subscriptions = await this.subscriptionModel
        .find({
          id: {
            $in: [...paidThisMonth, ...recent].map((i) => i.subscriptionId),
          },
        })
        .lean();
      const subscriptionOf = new Map(subscriptions.map((s) => [s.id, s]));
      const names = await this.namesOf([
        ...recent.map((i) => i.userId),
        ...failed.map((i) => i.userId),
        ...waiting.map((i) => i.userId),
        ...overdue.map((s) => s.userId),
      ]);

      const sum = (invoices: Invoice[]) =>
        roundCedis(invoices.reduce((total, i) => total + (i.amount ?? 0), 0));
      const yearly = paidThisMonth.filter(
        (i) =>
          subscriptionOf.get(i.subscriptionId)?.billingFrequency ===
          BillingFrequency.Yearly,
      );
      const attention: AttentionItem[] = [
        { kind: 'failed_payments' as const, people: failed.map((i) => i.userId) },
        { kind: 'waiting_payments' as const, people: waiting.map((i) => i.userId) },
        { kind: 'overdue_renewals' as const, people: overdue.map((s) => s.userId) },
      ]
        .filter((a) => a.people.length > 0)
        .map(({ kind, people }) => ({
          kind,
          count: people.length,
          names: [...new Set(people)].slice(0, 3).map((id) => names.get(id) ?? 'Someone'),
        }));

      return CommonResponses.OkResponse({
        ...(await this.trends(now)),
        asOf: now,
        users,
        paidUsers,
        revenue: {
          thisMonth: sum(paidThisMonth),
          lastMonth: sum(paidLastMonth),
          monthlyPlans: roundCedis(sum(paidThisMonth) - sum(yearly)),
          yearlyPlans: sum(yearly),
        },
        newPaidThisMonth,
        signups: { thisMonth: signupsThisMonth, google: googleThisMonth },
        renewalsDueNext7Days,
        attention,
        recentPayments: recent.map((i) => {
          const subscription = subscriptionOf.get(i.subscriptionId);
          return {
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            userName: names.get(i.userId) ?? 'Deleted account',
            planTitle: subscription?.planTitle ?? null,
            billingFrequency: subscription?.billingFrequency ?? null,
            amount: i.amount,
            currency: i.currency ?? 'GHS',
            status: i.status,
            paymentMethod: i.paymentMethod ?? null,
            failureReason: i.failureReason ?? null,
            at: i.datePaid ?? i.updatedAt ?? i.createdAt,
          };
        }),
      });
    } catch (error) {
      this.logger.error('Error building the admin overview', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  private async trends(now: Date): Promise<OverviewTrends> {
    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from30 = new Date(today.getTime() - 29 * DAY);
    const from12 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const dayKey = (d: Date) => new Date(d).toISOString().slice(0, 10);
    const monthKey = (d: Date) => new Date(d).toISOString().slice(0, 7);

    const plans = await this.billingPlanModel.find({}).lean();
    const planOf = new Map(plans.map((p) => [p.id, calculateYearlyPrice({ ...p })]));
    const freePlan = plans.find((p) => p.price <= 0);

    const [paid, signups, activeToday, activeWeek, activeMonth, running] = await Promise.all([
      this.invoiceModel
        .find({ status: PaymentStatus.Completed, amount: { $gt: 0 }, datePaid: { $gte: from12, $lte: now } })
        .lean(),
      this.userModel.find({ createdAt: { $gte: from30, $lte: now } }).lean(),
      this.transactionModel.distinct('userId', { recordedAt: { $gte: today } }),
      this.transactionModel.distinct('userId', { recordedAt: { $gte: new Date(now.getTime() - 7 * DAY) } }),
      this.transactionModel.distinct('userId', { recordedAt: { $gte: monthStart(now) } }),
      this.subscriptionModel.aggregate([
        { $match: { isActive: true, status: SubscriptionStatus.Active } },
        { $group: { _id: { plan: '$billingPlanId', frequency: '$billingFrequency' }, n: { $sum: 1 } } },
      ]),
    ]);

    const days = Array.from({ length: 30 }, (_, i) => dayKey(new Date(from30.getTime() + i * DAY)));
    const months = Array.from({ length: 12 }, (_, i) =>
      monthKey(new Date(Date.UTC(from12.getUTCFullYear(), from12.getUTCMonth() + i, 1))),
    );
    const byDay = new Map(days.map((d) => [d, 0]));
    const byMonth = new Map(months.map((m) => [m, 0]));
    for (const i of paid) {
      const d = dayKey(i.datePaid);
      if (byDay.has(d)) byDay.set(d, byDay.get(d) + i.amount);
      const m = monthKey(i.datePaid);
      if (byMonth.has(m)) byMonth.set(m, byMonth.get(m) + i.amount);
    }
    const signupDays = new Map(days.map((d) => [d, { google: 0, phone: 0 }]));
    for (const u of signups) {
      const bucket = signupDays.get(dayKey(u.createdAt));
      if (bucket) bucket[u.isGoogleAuth ? 'google' : 'phone']++;
    }

    let monthly = 0;
    const onPlan = new Map<string, number>();
    for (const row of running as { _id: { plan: string; frequency: BillingFrequency }; n: number }[]) {
      const plan = planOf.get(row._id.plan);
      if (!plan) continue;
      onPlan.set(plan.title, (onPlan.get(plan.title) ?? 0) + row.n);
      monthly += row.n * (row._id.frequency === BillingFrequency.Yearly ? plan.yearlyPrice / 12 : plan.price);
    }

    return {
      revenueByDay: days.map((date) => ({ date, amount: roundCedis(byDay.get(date)) })),
      revenueByMonth: months.map((month) => ({ month, amount: roundCedis(byMonth.get(month)) })),
      signupsByDay: days.map((date) => ({ date, ...signupDays.get(date) })),
      active: { today: activeToday.length, week: activeWeek.length, month: activeMonth.length },
      recurring: {
        monthly: roundCedis(monthly),
        plans: [...planOf.values()]
          .sort((a, b) => a.price - b.price)
          .map((p) => ({ title: p.title, count: onPlan.get(p.title) ?? 0 })),
      },
      nearLimit: await this.nearLimit(freePlan, now),
    };
  }

  /// People on [free] who've used 80% or more of its monthly entries, most first.
  private async nearLimit(free: BillingPlan | undefined, now: Date): Promise<OverviewTrends['nearLimit']> {
    const limit = free?.maxNumberOfTransactions ?? 0;
    if (!free || limit <= 0) return { count: 0, limit, people: [] };
    const counted = (await this.transactionModel.aggregate([
      { $match: { recordedAt: { $gte: monthStart(now) } } },
      { $group: { _id: '$userId', n: { $sum: 1 } } },
      { $match: { n: { $gte: Math.ceil(limit * 0.8) } } },
    ])) as { _id: string; n: number }[];
    if (!counted.length) return { count: 0, limit, people: [] };
    const onFree = new Set(
      (
        await this.subscriptionModel
          .find({ userId: { $in: counted.map((c) => c._id) }, isActive: true, billingPlanId: free.id })
          .lean()
      ).map((s) => s.userId),
    );
    const near = counted.filter((c) => onFree.has(c._id)).sort((a, b) => b.n - a.n);
    const names = await this.namesOf(near.slice(0, 5).map((c) => c._id));
    return {
      count: near.length,
      limit,
      people: near.slice(0, 5).map((c) => ({ id: c._id, name: names.get(c._id) ?? 'Someone', used: Math.min(c.n, limit) })),
    };
  }

  /// People's names (or phone or email when they gave no name), by id.
  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const users = await this.userModel.find({ id: { $in: unique } }).lean();
    return new Map(
      users.map((u) => [
        u.id,
        `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
          u.phoneNumber ||
          u.email ||
          'Someone',
      ]),
    );
  }
}
