import { ApiProperty } from '@nestjs/swagger';
import { BillingPlan } from 'src/schemas/billing.plan.schema';

export class SubscriptionResponse {
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
}
