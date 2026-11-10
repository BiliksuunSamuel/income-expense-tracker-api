import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { AccountKind } from 'src/enums';

/** Where money sits: Cash, a MoMo wallet, a bank account… */
@Schema()
export class Account extends BaseSchema {
  @Prop({ required: true, index: true })
  @ApiProperty()
  userId: string;

  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ required: true, default: AccountKind.Cash })
  @ApiProperty({ enum: AccountKind })
  kind: AccountKind;

  /** Money already in it before the first transaction. */
  @Prop({ required: true, default: 0 })
  @ApiProperty()
  openingBalance: number;

  /** The account new entries use when none is given (one per user). */
  @Prop({ required: true, default: false })
  @ApiProperty()
  isDefault: boolean;

  /** Hidden from pickers; its history still counts. */
  @Prop({ required: true, default: false })
  @ApiProperty()
  archived: boolean;
}
