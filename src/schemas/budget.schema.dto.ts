import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema()
export class Budget {
  @ApiProperty()
  @Prop()
  id: string;

  @ApiProperty()
  @Prop({ type: String, required: true })
  title: string;

  @ApiProperty()
  @Prop({ type: String })
  description: string;

  @ApiProperty()
  @Prop({ type: String, required: true })
  createdBy: string;

  @ApiProperty()
  @Prop({ type: Number, required: true })
  amount: number;

  @ApiProperty()
  @Prop({ type: String, required: true })
  category: string;

  @ApiProperty()
  @Prop({ default: false })
  receiveAlert: boolean;

  @ApiProperty()
  @Prop({ type: Number, default: 0 })
  receiveAlertPercentage: number;

  @ApiProperty()
  @Prop({ default: false })
  limitExceeded: boolean;

  @ApiProperty()
  @Prop({ default: 0 })
  progressValue: number;

  @ApiProperty()
  @Prop()
  updatedAt: Date;

  @ApiProperty()
  @Prop()
  createdAt: Date;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);
