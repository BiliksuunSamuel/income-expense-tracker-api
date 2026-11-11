import { Prop, Schema } from '@nestjs/mongoose';
import { BaseSchema } from '.';
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceKind, PaymentStatus } from 'src/enums';
import { PaymentGatewayDetails } from 'src/utils/paystack';

@Schema()
export class Invoice extends BaseSchema {
  @Prop({ required: true, type: String })
  @ApiProperty()
  subscriptionId: string;

  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  @Prop({
    required: true,
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.Pending,
  })
  @ApiProperty()
  status: PaymentStatus;

  @Prop({ type: Date, default: null })
  @ApiProperty()
  datePaid: Date;

  @Prop({ type: Date, required: true })
  @ApiProperty()
  dueDate: Date;

  @Prop({ type: String })
  @ApiProperty()
  paymentReference: string;

  @Prop()
  @ApiProperty()
  description: string;

  @Prop({ type: String, required: true })
  @ApiProperty()
  userId: string;

  @Prop({ type: Date, default: Date.now })
  @ApiProperty()
  startDate: Date;

  @Prop({ type: Date, default: Date.now })
  @ApiProperty()
  endDate: Date;

  @Prop({ type: String, required: true })
  @ApiProperty()
  invoiceNumber: string;

  @Prop({ type: String })
  @ApiProperty()
  authorizationUrl: string;

  /// Every checkout started for this invoice, the latest last.
  @Prop({ type: [String], default: [] })
  @ApiProperty({ type: [String] })
  paymentReferences: string[];

  @Prop({ type: Date, default: null })
  @ApiProperty()
  paymentStartedAt: Date;

  @Prop({ type: String, default: null })
  @ApiProperty()
  paymentMethod: string;

  @Prop({ type: String, default: null })
  @ApiProperty()
  failureReason: string;

  @Prop({ type: Object, default: null })
  @ApiProperty()
  gateway: PaymentGatewayDetails;

  @Prop({ type: String, default: 'GHS' })
  @ApiProperty()
  currency: string;

  @Prop({ type: String, enum: InvoiceKind, default: InvoiceKind.New })
  @ApiProperty({ enum: InvoiceKind })
  kind: InvoiceKind;

  @Prop({ type: String, default: null })
  @ApiProperty()
  billingPlanId: string;
}
