import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { SubscriptionRequestDto } from 'src/dtos/billing-plan/subscription-request.dto';
import { SubscriptionResponse } from 'src/dtos/billing-plan/subscription-response.dto';
import { SubscriptionsFilter } from 'src/dtos/billing-plan/subscriptions-filter.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { generateId } from 'src/utils';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(BillingPlan.name)
    private readonly billingPlanModel: Model<BillingPlan>,
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
      const subscription = await this.subscriptionModel.create({
        ...request,
        userId: authUser.id,
        isActive: true,
        startDate: new Date(),
        //end date in 5 yrs time
        endDate: new Date(new Date().getTime() + 5 * 365 * 24 * 60 * 60 * 1000),
        planTitle: billingPlan.title,
        id: generateId(),
        createdAt: new Date(),
        createdBy: authUser?.email,
      });
      this.logger.log(
        'Subscription created successfully',
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
        plan: billingPlan,
      };
      return CommonResponses.OkResponse(
        response,
        'Subscription created successfully',
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
        .findOne({ isActive: true, userId })
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
        plan: billingPlan,
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
      const subscription = await this.subscriptionModel.findById(id).lean();
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
        plan: billingPlan,
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
