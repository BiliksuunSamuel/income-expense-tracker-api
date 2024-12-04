import { ApiProperty } from '@nestjs/swagger';
import { BaseFilter } from 'src/common/base.filter.dto';
import { TransactionFilterPeriod } from 'src/enums';

export class TransactionFilter extends BaseFilter {
  @ApiProperty({ required: false, default: null })
  type: string;

  @ApiProperty({ required: false, default: null })
  currency: string;

  @ApiProperty({ required: false, default: null })
  category: string;

  @ApiProperty({ required: false, default: null })
  repeatTransaction?: boolean;

  @ApiProperty({ required: false, default: TransactionFilterPeriod.Today })
  period: TransactionFilterPeriod;
}
