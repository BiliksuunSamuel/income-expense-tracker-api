import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { TransactionRepeatFrequency, TransactionType } from 'src/enums';

export class TransactionRequest {
  /** Made by the app so a retried create saves once (offline sync). */
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  id?: string;

  /** When it happened; defaults to now. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty()
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @ApiProperty()
  @IsNotEmpty()
  amount: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  invoiceUrl: string;

  @ApiProperty({ default: false })
  @IsNotEmpty()
  repeatTransaction: boolean;

  @ApiProperty({ default: 0 })
  repeatInterval: number;

  @ApiProperty({ default: null })
  repeatTransactionEndDate: Date;

  @ApiProperty({ default: null })
  repeatFrequency: TransactionRepeatFrequency;

  @ApiProperty({ default: 'Default' })
  account: string;

  @ApiProperty({ default: null })
  invoiceFileName: string;

  @ApiProperty({ default: null })
  invoiceFileType: string;

  @ApiProperty({ default: null })
  invoice: any;

  @ApiProperty({ default: null })
  budgetId: string;
}
