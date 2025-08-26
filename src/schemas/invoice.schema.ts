import { Prop, Schema } from '@nestjs/mongoose';
import { BaseSchema } from '.';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from 'src/enums';

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

  @Prop({ type: Date, defualt: null })
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
}
