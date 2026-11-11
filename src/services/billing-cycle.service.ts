import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import configuration from 'src/configuration';
import {
  BillingFrequency,
  BillingPlanType,
  InvoiceKind,
  SubscriptionStatus,
} from 'src/enums';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { Transaction } from 'src/schemas/transaction.schema';
import { addMonths, generateId } from 'src/utils';
import {
  daysFromNow,
  graceEndsAt,
  monthStart,
} from 'src/utils/subscription-invoice';
import { BillingNoticeService } from './billing-notice.service';
import { InvoiceService } from './invoice.service';

/// What a user's plan allows right now.
export type PlanAccess = {
  subscription: Subscription;
  plan: BillingPlan | null;
  /// Entries recorded since the start of this calendar month.
  entriesThisMonth: () => Promise<number>;
};

/// Keeps plans in step with what was paid. A paid plan runs to its end
/// date, then a grace period; its renewal invoice goes out a few days before
/// the end. Unpaid by the end of the grace period, the plan expires and the
/// user is back on Regular. The entry limit counts per calendar month.
@Injectable()
export class BillingCycleService {
  private readonly logger = new Logger(BillingCycleService.name);
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(BillingPlan.name)
    private readonly billingPlanModel: Model<BillingPlan>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    private readonly invoiceService: InvoiceService,
    private readonly notices: BillingNoticeService,
  ) {}

  /// [userId]'s plan as it stands: a lapsed one is expired on the spot, and
  /// a user left without a plan is put on Regular. Null only when no
  /// Regular plan is set up.
  async access(userId: string, now = new Date()): Promise<PlanAccess | null> {
    let subscription: Subscription | null = await this.subscriptionModel
      .findOne({ userId, isActive: true })
      .lean();
    let plan = subscription ? await this.planOf(subscription) : null;

    const lapsed =
      subscription &&
      (subscription.status !== SubscriptionStatus.Active ||
        (plan?.price > 0 && graceEndsAt(subscription.endDate) < now));
    if (lapsed) await this.expire(subscription, now);
    if (!subscription || lapsed) {
      subscription = await this.ensureRegular(userId, now);
      plan = subscription ? await this.planOf(subscription) : null;
    }
    if (!subscription) return null;

    return {
      subscription,
      plan,
      entriesThisMonth: () =>
        this.transactionModel.countDocuments({
          userId,
          recordedAt: { $gte: monthStart(now) },
        }),
    };
  }

  /// Hourly: renewal invoices for plans ending soon, and expiry for those
  /// past their grace period.
  @Cron(CronExpression.EVERY_HOUR)
  async runBillingCycle(now = new Date()): Promise<void> {
    try {
      await this.issueRenewals(now);
      await this.expireLapsed(now);
    } catch (error) {
      this.logger.error('Error running the billing cycle', error);
    }
  }

  async issueRenewals(now = new Date()): Promise<void> {
    const { renewalNoticeDays, graceDays } = configuration().billing;
    const ending = await this.subscriptionModel
      .find({
        isActive: true,
        status: SubscriptionStatus.Active,
        endDate: {
          $lte: daysFromNow(renewalNoticeDays, now),
          $gte: daysFromNow(-graceDays, now),
        },
      })
      .limit(500)
      .lean();
    for (const subscription of ending) {
      const plan = await this.planOf(subscription);
      if (!plan || plan.price <= 0) continue;
      const issued = await this.invoiceModel
        .findOne({
          subscriptionId: subscription.id,
          kind: InvoiceKind.Renewal,
          dueDate: subscription.endDate,
        })
        .lean();
      if (issued) continue;
      await this.invoiceService.createRenewal(subscription, plan);
    }
  }

  async expireLapsed(now = new Date()): Promise<void> {
    const lapsed = await this.subscriptionModel
      .find({
        isActive: true,
        status: SubscriptionStatus.Active,
        endDate: { $lt: daysFromNow(-configuration().billing.graceDays, now) },
      })
      .limit(500)
      .lean();
    for (const subscription of lapsed) {
      const plan = await this.planOf(subscription);
      if (!plan || plan.price <= 0) continue;
      await this.expire(subscription, now);
      await this.ensureRegular(subscription.userId, now);
    }
  }

  /// Ends [subscription] once, however many requests notice it at the same
  /// time: its unpaid renewal is withdrawn and the user told.
  private async expire(subscription: Subscription, now: Date) {
    // A plan that never started (left unpaid) ends without a notice.
    const wasRunning = subscription.status === SubscriptionStatus.Active;
    const result = await this.subscriptionModel.updateOne(
      { id: subscription.id, isActive: true },
      {
        isActive: false,
        status: SubscriptionStatus.Expired,
        updatedAt: now,
      },
    );
    if (!result?.modifiedCount) return;
    await this.invoiceService.cancelUnpaid([subscription.id]);
    this.logger.log('Plan expired', {
      subscriptionId: subscription.id,
      userId: subscription.userId,
    });
    if (wasRunning) await this.notices.expired(subscription);
  }

  /// [userId] on Regular: their earlier Regular plan reopened, or a new one.
  private async ensureRegular(
    userId: string,
    now: Date,
  ): Promise<Subscription | null> {
    const active = await this.subscriptionModel
      .findOne({ userId, isActive: true })
      .lean();
    if (active) return active;
    const regular = await this.billingPlanModel
      .findOne({ title: BillingPlanType.Regular })
      .lean();
    if (!regular) {
      this.logger.error('No Regular plan is set up');
      return null;
    }
    return this.subscriptionModel
      .findOneAndUpdate(
        { userId, billingPlanId: regular.id },
        {
          $set: {
            isActive: true,
            status: SubscriptionStatus.Active,
            maxNumberOfTransactions: regular.maxNumberOfTransactions || 0,
            updatedAt: now,
          },
          $setOnInsert: {
            id: generateId(),
            userId,
            billingPlanId: regular.id,
            planTitle: regular.title,
            billingFrequency: BillingFrequency.Monthly,
            startDate: now,
            endDate: addMonths(now, 12),
            createdAt: now,
            createdBy: 'system',
          },
        },
        { upsert: true, new: true },
      )
      .lean();
  }

  private planOf(subscription: Subscription): Promise<BillingPlan | null> {
    return this.billingPlanModel
      .findOne({ id: subscription.billingPlanId })
      .lean();
  }
}
