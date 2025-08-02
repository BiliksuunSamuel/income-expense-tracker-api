import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { SubscriptionRequestDto } from 'src/dtos/billing-plan/subscription-request.dto';
import { SubscriptionResponse } from 'src/dtos/billing-plan/subscription-response.dto';
import { SubscriptionsFilter } from 'src/dtos/billing-plan/subscriptions-filter.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { SubscriptionService } from 'src/services/subscription.service';

@Controller('api/subscriptions')
@ApiTags('Subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  async filterSubscriptions(
    @Query() filter: SubscriptionsFilter,
    @Res() response: Response,
  ) {
    const res = await this.subscriptionService.filterSubscriptions(filter);
    response.status(res.code).send(res);
  }

  @Post()
  @ApiResponse({ type: SubscriptionResponse })
  async createSubscription(
    @Body() request: SubscriptionRequestDto,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.subscriptionService.buySubscription(request, user);
    response.status(res.code).send(res);
  }

  @Get(':subscriptionId')
  @ApiParam({ name: 'subscriptionId', type: String })
  @ApiResponse({ type: SubscriptionResponse })
  async getSubscriptionDetails(
    @Param('subscriptionId') subscriptionId: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res =
      await this.subscriptionService.getSubscriptionById(subscriptionId);
    response.status(res.code).send(res);
  }

  @Get('active')
  @ApiResponse({ type: SubscriptionResponse })
  async getActiveSubscription(
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.subscriptionService.getUserActiveSubscription(
      user.id,
    );
    response.status(res.code).send(res);
  }
}
