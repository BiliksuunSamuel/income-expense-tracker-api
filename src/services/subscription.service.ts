import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { dispatch } from 'nact';
import { InvoiceActor } from 'src/actors/invoice.actor';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { SubscriptionRequestDto } from 'src/dtos/billing-plan/subscription-request.dto';
import { SubscriptionResponse } from 'src/dtos/billing-plan/subscription-response.dto';
import { SubscriptionsFilter } from 'src/dtos/billing-plan/subscriptions-filter.dto';
import { BillingPlanType, SubscriptionStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { UserRepository } from 'src/repositories/user.repository';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { calculateYearlyPrice, generateId } from 'src/utils';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(BillingPlan.name)
    private readonly billingPlanModel: Model<BillingPlan>,
    private readonly invoiceActor: InvoiceActor,
    private readonly userRepository: UserRepository,
  ) {}

  //buy subscription
  async buySubscription(
    request: SubscriptionRequestDto,
    authUser: UserJwtDetails,
  ): Promise<ApiResponseDto<SubscriptionResponse>> {
    try {
      const billingPlan = await this.billingPlanModel
        .findOne({ id: request.billingPlanId })
        .lean();
      if (!billingPlan) {
        this.logger.error('Billing plan not found', request, authUser);
        return CommonResponses.NotFoundResponse('Billing plan not found');
      }

      if (billingPlan.title === BillingPlanType.Regular) {
        const planAlreadyPurchased = await this.subscriptionModel.findOne({
          userId: authUser.id,
          planTitle: billingPlan.title,
        });
        if (planAlreadyPurchased) {
          //this plan is a one time purchase plan
          this.logger.warn('User already has a regular plan', {
            userId: authUser.id,
            planTitle: billingPlan.title,
          });
          return CommonResponses.ForbiddenResponse(
            'This plan is a one time purchase plan, please choose another plan.',
          );
        }
      }

      const subscription = await this.subscriptionModel.create({
        ...request,
        userId: authUser.id,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        planTitle: billingPlan.title,
        id: generateId(),
        createdAt: new Date(),
        createdBy: authUser?.email,
        status:
          billingPlan.price == 0
            ? SubscriptionStatus.Active
            : SubscriptionStatus.Pending,
        maxNumberOfTransactions: billingPlan.maxNumberOfTransactions || 0,
        billingPlanId: billingPlan.id,
      });
      this.logger.log(
        'Subscription created successfully. Please settle your invoice to activate it.',
        subscription.toObject(),
        request,
        authUser,
      );
      const doc = subscription.toObject();
      const response: SubscriptionResponse = {
        startDate: doc.startDate,
        endDate: doc.endDate,
        isActive: doc.isActive,
        planTitle: doc.planTitle,
        plan: calculateYearlyPrice(billingPlan),
        maxNumberOfTransactions: doc.maxNumberOfTransactions,
        status: doc.status,
        billingFrequency: doc.billingFrequency,
        id: doc.id,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
      };
      // Create invoice for the subscription
      dispatch(this.invoiceActor.createInvoiceForSubscription, {
        subscription,
        billingPlan,
      });

      //Close other subscriptions for the user
      await this.subscriptionModel.updateMany(
        { userId: authUser.id, id: { $ne: subscription.id } },
        { isActive: false, status: SubscriptionStatus.Closed },
      );
      return CommonResponses.OkResponse(
        response,
        billingPlan.price <= 0
          ? 'Subscription created successfully.'
          : 'Subscription created successfully. Please settle your invoice to activate it.',
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
      const activeSubscription = await this.subscriptionModel
        .findOne({ userId, isActive: true })
        .lean();
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
      const response: SubscriptionResponse = {
        startDate: activeSubscription.startDate,
        endDate: activeSubscription.endDate,
        isActive: activeSubscription.isActive,
        planTitle: activeSubscription.planTitle,
        plan: calculateYearlyPrice(billingPlan),
        maxNumberOfTransactions: activeSubscription.maxNumberOfTransactions,
        status: activeSubscription.status,
        billingFrequency: activeSubscription.billingFrequency,
        id: activeSubscription.id,
        createdAt: activeSubscription.createdAt,
        createdBy: activeSubscription.createdBy,
        updatedAt: activeSubscription.updatedAt,
        updatedBy: activeSubscription.updatedBy,
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
  ): Promise<ApiResponseDto<SubscriptionResponse>> {
    try {
      const subscription = await this.subscriptionModel.findOne({ id }).lean();
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
      const response: SubscriptionResponse = {
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        isActive: subscription.isActive,
        planTitle: subscription.planTitle,
        plan: calculateYearlyPrice(billingPlan),
        maxNumberOfTransactions: subscription.maxNumberOfTransactions,
        status: subscription.status,
        billingFrequency: subscription.billingFrequency,
        id: subscription.id,
        createdAt: subscription.createdAt,
        createdBy: subscription.createdBy,
        updatedAt: subscription.updatedAt,
        updatedBy: subscription.updatedBy,
      };
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
      if (filter.query) {
        query.planTitle = { $regex: filter.query, $options: 'i' };
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
