import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AccountKind } from 'src/enums';

export class AccountRequest {
  /** Made by the app so a retried create saves once. */
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @ApiProperty({ enum: AccountKind })
  @IsEnum(AccountKind)
  kind: AccountKind;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  openingBalance?: number;
}

export class AccountUpdate {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name?: string;

  @ApiProperty({ enum: AccountKind, required: false })
  @IsOptional()
  @IsEnum(AccountKind)
  kind?: AccountKind;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  openingBalance?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class AccountWithBalance {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: AccountKind }) kind: AccountKind;
  @ApiProperty() openingBalance: number;
  @ApiProperty() isDefault: boolean;
  @ApiProperty() archived: boolean;
  @ApiProperty() balance: number;
  /** The balance just before `since`, when asked for (offline copies). */
  @ApiProperty({ required: false }) balanceBefore?: number;
  @ApiProperty() createdAt: Date;
}
