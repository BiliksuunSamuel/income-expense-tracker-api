import { Body, Controller, Get, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { BillingPlanRequestDto } from 'src/dtos/billing-plan/billing-plan-request.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { BillingPlanService } from 'src/services/billing.plan.service';

@Controller('api/billing-plans')
@ApiTags('Billing Plans')
export class BillingPlanController {
  constructor(private readonly billingPlanService: BillingPlanService) {}

  @Get()
  @ApiResponse({ type: [BillingPlan] })
  async getAllBillingPlans(@Res() response: Response) {
    const res = await this.billingPlanService.getBillingPlans();
    response.status(res.code).send(res);
  }

  @Post()
  @ApiResponse({ type: BillingPlan })
  async createBillingPlan(
    @Body() request: BillingPlanRequestDto,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.billingPlanService.createBillingPlan(request, user);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @ApiResponse({ type: BillingPlan })
  @ApiParam({ name: 'id', required: true })
  async updateBillingPlan(
    @Param('id') id: string,
    @Body() request: BillingPlanRequestDto,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.billingPlanService.updateBillingPlan(
      id,
      request,
      user,
    );
    response.status(res.code).send(res);
  }

  @Get(':id')
  @ApiResponse({ type: BillingPlan })
  @ApiParam({ name: 'id', required: true })
  async getBillingPlanById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.billingPlanService.getBillingPlanById(id);
    response.status(res.code).send(res);
  }
}
