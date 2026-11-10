import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';

/** Money moved between two of a user's accounts. Not income or expense. */
@Schema()
export class Transfer extends BaseSchema {
  @Prop({ required: true, index: true })
  @ApiProperty()
  userId: string;

  @Prop({ required: true })
  @ApiProperty()
  fromAccountId: string;

  @Prop({ required: true })
  @ApiProperty()
  toAccountId: string;

  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  @Prop({ default: '' })
  @ApiProperty()
  note: string;
}
