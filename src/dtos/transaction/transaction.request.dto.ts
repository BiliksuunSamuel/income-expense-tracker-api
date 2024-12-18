import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TransactionRepeatFrequency, TransactionType } from 'src/enums';

export class TransactionRequest {
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
