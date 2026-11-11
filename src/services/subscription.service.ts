import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { SubscriptionRequestDto } from 'src/dtos/billing-plan/subscription-request.dto';
import { SubscriptionResponse } from 'src/dtos/billing-plan/subscription-response.dto';
import { SubscriptionsFilter } from 'src/dtos/billing-plan/subscriptions-filter.dto';
import {
  BillingPlanType,
  InvoiceKind,
  PaymentStatus,
  SubscriptionStatus,
} from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { UserRepository } from 'src/repositories/user.repository';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import {
  addMonths,
  calculateYearlyPrice,
  generateId,
  getInvoiceStartDateAndEndDate,
} from 'src/utils';
import { graceEndsAt } from 'src/utils/subscription-invoice';
import { Invoice } from 'src/schemas/invoice.schema';
import { BillingCycleService } from './billing-cycle.service';
import { literalPattern } from 'src/utils/transaction-query';
import { InvoiceService, InvoiceView } from './invoice.service';

/// A chosen plan, with the invoice to pay when it isn't free.
export type SubscriptionPurchase = SubscriptionResponse & {
  invoice: InvoiceView | null;
};

function toResponse(
  doc: Subscription,
  plan: BillingPlan,
): SubscriptionResponse {
  return {
    startDate: doc.startDate,
    endDate: doc.endDate,
    isActive: doc.isActive,
    planTitle: doc.planTitle,
    plan: calculateYearlyPrice(plan),
    maxNumberOfTransactions: doc.maxNumberOfTransactions,
    status: doc.status,
    billingFrequency: doc.billingFrequency,
    id: doc.id,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy,
  };
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(BillingPlan.name)
    private readonly billingPlanModel: Model<BillingPlan>,
    private readonly invoiceService: InvoiceService,
    private readonly userRepository: UserRepository,
    private readonly billing: BillingCycleService,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
  ) {}

  /// Chooses [request]'s plan. A free plan starts now; a paid one waits,
  /// with the current plan kept, until Paystack confirms its invoice (see
  /// InvoiceService), and comes back with that invoice's checkout.
  async buySubscription(
    request: SubscriptionRequestDto,
    authUser: UserJwtDetails,
  ): Promise<ApiResponseDto<SubscriptionPurchase>> {
    try {
      const billingPlan = await this.billingPlanModel
        .findOne({ id: request.billingPlanId })
        .lean();
      if (!billingPlan) {
        return CommonResponses.NotFoundResponse('Billing plan not found');
      }

      if (billingPlan.title === BillingPlanType.Regular) {
        const planAlreadyPurchased = await this.subscriptionModel.findOne({
          userId: authUser.id,
          planTitle: billingPlan.title,
        });
        if (planAlreadyPurchased) {
          return CommonResponses.ForbiddenResponse(
            'This plan is a one time purchase plan, please choose another plan.',
          );
        }
      }

      const current = await this.subscriptionModel
        .findOne({ userId: authUser.id, isActive: true })
        .lean();
      if (
        current?.status === SubscriptionStatus.Active &&
        current.billingPlanId === billingPlan.id &&
        current.billingFrequency === request.billingFrequency
      ) {
        return CommonResponses.ConflictResponse("You're already on this plan.");
      }

      const free = billingPlan.price <= 0;
      const now = new Date();
      // Earlier choices left unpaid give way to this one, invoices too.
      const stale = await this.subscriptionModel
        .find({
          userId: authUser.id,
          isActive: false,
          status: SubscriptionStatus.Pending,
        })
        .lean();
      await this.subscriptionModel.updateMany(
        { id: { $in: stale.map((s) => s.id) } },
        { status: SubscriptionStatus.Closed, updatedAt: now },
      );
      await this.invoiceService.cancelUnpaid(stale.map((s) => s.id));
      const doc = await this.subscriptionModel.create({
        billingFrequency: request.billingFrequency,
        userId: authUser.id,
        isActive: free,
        startDate: now,
        endDate: free
          ? addMonths(now, 12)
          : getInvoiceStartDateAndEndDate({
              startDate: now,
              billingFrequency: request.billingFrequency,
            }).endDate,
        planTitle: billingPlan.title,
        id: generateId(),
        createdAt: now,
        createdBy: authUser?.email,
        status: free ? SubscriptionStatus.Active : SubscriptionStatus.Pending,
        maxNumberOfTransactions: billingPlan.maxNumberOfTransactions || 0,
        billingPlanId: billingPlan.id,
      });
      const subscription = doc.toObject();
      const invoice = await this.invoiceService.createForSubscription(
        subscription,
        billingPlan,
      );

      if (free) {
        await this.subscriptionModel.updateMany(
          { userId: authUser.id, id: { $ne: subscription.id }, isActive: true },
          { isActive: false, status: SubscriptionStatus.Closed, updatedAt: now },
        );
        return CommonResponses.OkResponse(
          { ...toResponse(subscription, billingPlan), invoice: null },
          'Subscription created successfully.',
        );
      }

      const payment = await this.invoiceService.payInvoiceAsync(
        invoice.id,
        authUser,
      );
      return CommonResponses.OkResponse(
        {
          ...toResponse(subscription, billingPlan),
          invoice: payment.data ?? InvoiceService.view(invoice),
        },
        payment.data
          ? 'Pay to start your new plan.'
          : "Couldn't reach Paystack. Pay from your invoices to start the plan.",
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while buying subscription',
        request,
        authUser,
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  //get usre active subscription
  async getUserActiveSubscription(
    userId: string,
  ): Promise<ApiResponseDto<SubscriptionResponse>> {
    try {
      // Brings a lapsed plan up to date before it's shown.
      const access = await this.billing.access(userId);
      const activeSubscription = access?.subscription;
      if (!activeSubscription) {
        this.logger.warn('No active subscription found for user', { userId });
        return CommonResponses.NotFoundResponse('No active subscription found');
      }
      const billingPlan = await this.billingPlanModel
        .findOne({
          id: activeSubscription.billingPlanId,
        })
        .lean();
      if (!billingPlan) {
        this.logger.error('Billing plan not found for active subscription', {
          userId,
          billingPlanId: activeSubscription.billingPlanId,
        });
        return CommonResponses.NotFoundResponse(
          'You do not have an active subscription',
        );
      }
      const paid = billingPlan.price > 0;
      const renewal = paid
        ? await this.invoiceModel
            .findOne({
              subscriptionId: activeSubscription.id,
              kind: InvoiceKind.Renewal,
              status: {
                $in: [
                  PaymentStatus.Pending,
                  PaymentStatus.Processing,
                  PaymentStatus.Failed,
                ],
              },
            })
            .lean()
        : null;
      const response: SubscriptionResponse = {
        ...toResponse(activeSubscription, billingPlan),
        entriesThisMonth: await access.entriesThisMonth(),
        renewalInvoiceId: renewal?.id ?? null,
        graceEndsAt: paid ? graceEndsAt(activeSubscription.endDate) : null,
      };
      this.logger.log('User active subscription fetched successfully', {
        userId,
        response,
      });
      return CommonResponses.OkResponse(
        response,
        'User active subscription fetched successfully',
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching user active subscription',
        { userId },
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  //get subscription by id
  async getSubscriptionById(
    id: string,
    userId: string,
  ): Promise<ApiResponseDto<SubscriptionResponse>> {
    try {
      const subscription = await this.subscriptionModel
        .findOne({ id, userId })
        .lean();
      if (!subscription) {
        this.logger.warn('Subscription not found', { id });
        return CommonResponses.NotFoundResponse('Subscription not found');
      }
      const billingPlan = await this.billingPlanModel
        .findOne({ id: subscription.billingPlanId })
        .lean();
      if (!billingPlan) {
        this.logger.error('Billing plan not found for subscription', { id });
        return CommonResponses.NotFoundResponse('Billing plan not found');
      }
      const response = toResponse(subscription, billingPlan);
      this.logger.log('Subscription fetched successfully', { id, response });
      return CommonResponses.OkResponse(
        response,
        'Subscription fetched successfully',
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching subscription by id',
        { id },
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  //get suscriptions
  async filterSubscriptions(
    filter: SubscriptionsFilter,
  ): Promise<ApiResponseDto<PagedResults<Subscription>>> {
    try {
      const { page, pageSize } = filter;
      const query: any = {};
      if (filter.userId) {
        query.userId = filter.userId;
      }
      if (filter.isActive !== undefined) {
        query.isActive = filter.isActive;
      }
      if (typeof filter.query === 'string' && filter.query) {
        query.planTitle = literalPattern(filter.query);
      }
      if (filter.billingPlanId) {
        query.billingPlanId = filter.billingPlanId;
      }
      const totalCount = await this.subscriptionModel.countDocuments(query);
      const subscriptions = await this.subscriptionModel
        .find(query)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .lean();

      const response: PagedResults<Subscription> = {
        results: subscriptions,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };

      return CommonResponses.OkResponse(
        response,
        'Subscriptions fetched successfully',
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while filtering subscriptions',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }
}
