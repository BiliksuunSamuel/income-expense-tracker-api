import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

export class BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  id: string;

  @Prop({ required: true, default: new Date() })
  @ApiProperty()
  createdAt: Date;

  @Prop({ required: false, default: null })
  @ApiProperty()
  updatedAt: Date;

  @Prop({ required: false, default: null })
  @ApiProperty()
  updatedBy: string;

  @Prop({ required: false, default: null })
  @ApiProperty()
  createdBy: string;
}
