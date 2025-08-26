import { ApiProperty } from '@nestjs/swagger';
import { BillingFrequency, SubscriptionStatus } from 'src/enums';
import { BaseSchema } from 'src/schemas';
import { BillingPlan } from 'src/schemas/billing.plan.schema';

export class SubscriptionResponse extends BaseSchema {
  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  planTitle: string;

  @ApiProperty()
  plan: BillingPlan;

  @ApiProperty()
  maxNumberOfTransactions: number;

  @ApiProperty()
  status: SubscriptionStatus;

  @ApiProperty()
  billingFrequency: BillingFrequency;
}
