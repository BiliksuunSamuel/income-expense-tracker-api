import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema()
export class BudgetCategory {
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
}
