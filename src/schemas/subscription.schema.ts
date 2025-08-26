import { Prop, Schema } from '@nestjs/mongoose';
import { BaseSchema } from '.';
import { ApiProperty } from '@nestjs/swagger';
import { BillingFrequency, SubscriptionStatus } from 'src/enums';

@Schema()
export class Subscription extends BaseSchema {
  @Prop({ required: true, type: String })
  @ApiProperty()
  userId: string;

  @Prop({ required: true, type: String })
  @ApiProperty()
  billingPlanId: string;

  @Prop({ required: true, type: String })
  @ApiProperty()
  planTitle: string;

  @Prop({ required: true, type: Date })
  @ApiProperty()
  startDate: Date;

  @Prop({ required: true, type: Date })
  @ApiProperty()
  endDate: Date;

  @Prop({ default: false, type: Boolean })
  @ApiProperty()
  isActive: boolean;

  @Prop({
    default: BillingFrequency.Monthly,
    type: String,
    enum: BillingFrequency,
  })
  @ApiProperty({ enum: BillingFrequency })
  @Prop({
    enum: BillingFrequency,
    type: String,
    default: BillingFrequency.Monthly,
  })
  billingFrequency: BillingFrequency;

  @Prop({ default: 0, type: Number })
  @ApiProperty()
  maxNumberOfTransactions: number;

  @Prop({ type: String, default: SubscriptionStatus.Pending })
  @ApiProperty()
  status: SubscriptionStatus;
}
