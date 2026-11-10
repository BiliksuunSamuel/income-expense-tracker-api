import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from 'src/enums';

/** One category's total for one month. */
export class MonthlyCategoryTotal {
  /** "2026-11" in the user's time zone. */
  @ApiProperty() month: string;
  @ApiProperty({ enum: TransactionType }) type: TransactionType;
  @ApiProperty() category: string;
  @ApiProperty() total: number;
  @ApiProperty() count: number;
}
