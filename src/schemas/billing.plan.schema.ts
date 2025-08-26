import { Prop, Schema } from '@nestjs/mongoose';
import { BaseSchema } from '.';
import { ApiProperty } from '@nestjs/swagger';
import { BillingPlanType } from 'src/enums';

@Schema()
export class BillingPlan extends BaseSchema {
  @Prop({
    required: true,
    unique: true,
    type: String,
    enum: BillingPlanType,
    default: BillingPlanType.Regular,
  })
  @ApiProperty()
  title: BillingPlanType;

  @Prop({ required: true })
  @ApiProperty()
  description: string;

  @Prop({ default: 0, min: 0 })
  @ApiProperty()
  price: number;

  @Prop({ default: 0 })
  @ApiProperty()
  yearlyDiscount: number;

  @Prop({ default: [] })
  @ApiProperty({ type: [String] })
  features: string[];

  @Prop({ default: [] })
  @ApiProperty({ type: [String] })
  unavailableFeatures: string[];

  @ApiProperty()
  yearlyPrice: number;

  @Prop({ default: 0, type: Number })
  @ApiProperty()
  maxNumberOfTransactions: number;
}
