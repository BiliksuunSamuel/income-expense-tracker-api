import { ApiProperty } from '@nestjs/swagger';

export class RecurringTransactionUpdate {
  @ApiProperty({ required: false })
  amount?: number;

  @ApiProperty({ required: false })
  description?: string;
}
