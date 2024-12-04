import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from 'src/enums';

@Schema()
export class Category {
  @Prop()
  @ApiProperty()
  id: string;

  @Prop()
  @ApiProperty()
  title: string;

  @Prop()
  @ApiProperty()
  creatorId: string;

  @Prop()
  @ApiProperty()
  type: CategoryType;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
