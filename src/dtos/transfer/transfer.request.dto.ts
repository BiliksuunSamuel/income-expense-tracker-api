import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class TransferRequest {
  /** Made by the app so a retried create saves once (offline sync). */
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fromAccountId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toAccountId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;

  /** When it happened; defaults to now. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}
