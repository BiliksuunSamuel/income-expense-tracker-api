import { ApiProperty } from '@nestjs/swagger';
import {
  RecurringTransactionStatus,
  TransactionRepeatFrequency,
  TransactionType,
} from 'src/enums';

export class RecurringTransactionResponse {
  @ApiProperty()
  id: string;
  @ApiProperty()
  type: TransactionType;
  @ApiProperty()
  amount: number;
  @ApiProperty()
  currency: string;
  @ApiProperty()
  category: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  budgetId: string;
  @ApiProperty()
  frequency: TransactionRepeatFrequency;
  @ApiProperty()
  interval: number;
  @ApiProperty()
  repeatUntil: Date;
  @ApiProperty()
  nextRunAt: Date;
  @ApiProperty()
  lastRunAt: Date;
  @ApiProperty()
  status: RecurringTransactionStatus;
  @ApiProperty()
  createdAt: Date;
}
