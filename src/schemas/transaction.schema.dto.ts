import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseSchema } from './base.schema.dto';
import { TransactionRepeatFrequency, TransactionType } from 'src/enums';
import { ApiProperty } from '@nestjs/swagger';

@Schema()
export class Transaction extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  type: TransactionType;

  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  @Prop({ required: true })
  @ApiProperty()
  year: number;

  @Prop({ required: true })
  @ApiProperty()
  month: number;

  @Prop({ required: true })
  @ApiProperty()
  currency: string;

  @Prop({ required: true })
  @ApiProperty()
  category: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  @Prop({ default: null })
  @ApiProperty()
  invoiceUrl: string;

  @Prop({ required: true })
  @ApiProperty()
  userId: string;

  @Prop({ required: true, default: false })
  @ApiProperty()
  repeatTransaction: boolean;

  @Prop({ default: 0 })
  @ApiProperty()
  repeatInterval: number;

  @Prop({ default: null })
  @ApiProperty()
  repeatTransactionEndDate: Date;

  @Prop({ default: null })
  @ApiProperty()
  repeatFrequency: TransactionRepeatFrequency;

  @Prop({ required: true, default: 'Default' })
  @ApiProperty()
  account: string;

  @Prop({ required: true })
  @ApiProperty()
  username: string;

  @Prop({ default: null })
  @ApiProperty()
  invoiceFileName: string;

  @Prop({ default: null })
  @ApiProperty()
  invoiceFileType: string;

  @Prop({ default: null })
  @ApiProperty()
  budgetId: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
