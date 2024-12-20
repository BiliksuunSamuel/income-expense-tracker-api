import { ApiProperty } from '@nestjs/swagger';
import { BaseFilter } from 'src/common/base.filter.dto';
import { BudgetStatus } from 'src/enums';

export class BudgetFilter extends BaseFilter {
  @ApiProperty({
    required: false,
    default: BudgetStatus.Active,
    enum: BudgetStatus,
  })
  status: BudgetStatus;
}
