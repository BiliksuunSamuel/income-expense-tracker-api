import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { BillingPlanRequestDto } from 'src/dtos/billing-plan/billing-plan-request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { generateId } from 'src/utils';

@Injectable()
export class BillingPlanService {
  private readonly logger = new Logger(BillingPlanService.name);
  constructor(
    @InjectModel(BillingPlan.name)
    private readonly billingPlanModel: Model<BillingPlan>,
  ) {}

  //add new billing plan
  async createBillingPlan(
    request: BillingPlanRequestDto,
    authUser: UserJwtDetails,
  ): Promise<ApiResponseDto<BillingPlan>> {
    try {
      const doc = await this.billingPlanModel.create({
        ...request,
        createdAt: new Date(),
        createdBy: authUser?.email ?? 'system',
        id: generateId(),
      });
      this.logger.log('New billing plan created', doc.toObject());
      return CommonResponses.CreatedResponse(
        doc.toObject(),
        'Billing plan created successfully',
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while creating billing plan',
        request,
        authUser,
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  //update billing plan
  async updateBillingPlan(
    id: string,
    request: BillingPlanRequestDto,
    authUser: UserJwtDetails,
  ): Promise<ApiResponseDto<BillingPlan>> {
    try {
      const doc = await this.billingPlanModel
        .findByIdAndUpdate(
          { id },
          { ...request, updatedAt: new Date(), updatedBy: authUser.email },
          { new: true },
        )
        .lean();
      if (!doc) {
        this.logger.warn(`Billing plan with id ${id} not found`);
        return CommonResponses.NotFoundResponse('Billing plan not found');
      }
      this.logger.log('Billing plan updated successfully', doc);
      return CommonResponses.OkResponse(
        doc,
        'Billing plan updated successfully',
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while updating billing plan',
        request,
        authUser,
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  //get all billing plans
  async getBillingPlans(): Promise<ApiResponseDto<BillingPlan[]>> {
    try {
      const plans = await this.billingPlanModel.find().lean();
      this.logger.log(`Retrieved ${plans.length} billing plans`);
      return CommonResponses.OkResponse(
        plans,
        'Billing plans retrieved successfully',
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching billing plans',
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  // get billing plan by id
  async getBillingPlanById(id: string): Promise<ApiResponseDto<BillingPlan>> {
    try {
      const plan = await this.billingPlanModel.findById(id).lean();
      if (!plan) {
        this.logger.warn(`Billing plan with id ${id} not found`);
        return CommonResponses.NotFoundResponse('Billing plan not found');
      }
      this.logger.log('Billing plan retrieved successfully', plan);
      return CommonResponses.OkResponse(
        plan,
        'Billing plan retrieved successfully',
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while fetching billing plan by id',
        { id },
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  //delete billing plan
  async deleteBillingPlan(id: string): Promise<ApiResponseDto<null>> {
    try {
      const result = await this.billingPlanModel.findByIdAndDelete(id);
      if (!result) {
        this.logger.warn(`Billing plan with id ${id} not found`);
        return CommonResponses.NotFoundResponse('Billing plan not found');
      }
      this.logger.log(`Billing plan with id ${id} deleted successfully`);
      return CommonResponses.OkResponse(
        null,
        'Billing plan deleted successfully',
      );
    } catch (error) {
      this.logger.error(
        'An error occurred while deleting billing plan',
        { id },
        error,
      );
      return CommonResponses.InternalServerErrorResponse();
    }
  }
}
