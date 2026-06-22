import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import {
  RecurringTransactionStatus,
  TransactionRepeatFrequency,
  TransactionType,
} from 'src/enums';

/// A template that the scheduler uses to mint transactions on a cadence.
@Schema()
export class RecurringTransaction extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  userId: string;

  @Prop({ required: true })
  @ApiProperty()
  username: string;

  @Prop({ required: true })
  @ApiProperty()
  type: TransactionType;

  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  @Prop({ required: true })
  @ApiProperty()
  currency: string;

  @Prop({ required: true })
  @ApiProperty()
  category: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  @Prop({ required: true, default: 'Default' })
  @ApiProperty()
  account: string;

  @Prop({ default: null })
  @ApiProperty()
  budgetId: string;

  @Prop({ required: true })
  @ApiProperty()
  frequency: TransactionRepeatFrequency;

  @Prop({ default: 1 })
  @ApiProperty()
  interval: number;

  @Prop({ default: null })
  @ApiProperty()
  repeatUntil: Date;

  /// When the next transaction should be generated.
  @Prop({ required: true })
  @ApiProperty()
  nextRunAt: Date;

  @Prop({ default: null })
  @ApiProperty()
  lastRunAt: Date;

  @Prop({ required: true, default: RecurringTransactionStatus.Active })
  @ApiProperty()
  status: RecurringTransactionStatus;
}
