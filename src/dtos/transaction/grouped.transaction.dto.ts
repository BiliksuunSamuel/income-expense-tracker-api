import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from 'src/schemas/transaction.schema';

export class GroupedTransactionDto {
  @ApiProperty({ type: [Transaction] })
  today: Transaction[];
  @ApiProperty({ type: [Transaction] })
  yesterday: Transaction[];
}
