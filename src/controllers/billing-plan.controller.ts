import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { BillingPlanRequestDto } from 'src/dtos/billing-plan/billing-plan-request.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AdminGuard } from 'src/providers/admin.guard';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
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

  /// Every plan's price and limits for the public website; no sign-in.
  @Get('public')
  async getPublicBillingPlans(@Res() response: Response) {
    const res = await this.billingPlanService.getPublicBillingPlans();
    response.status(res.code).send(res);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
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
  @UseGuards(JwtAuthGuard, AdminGuard)
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
