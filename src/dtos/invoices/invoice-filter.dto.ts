import { ApiProperty } from '@nestjs/swagger';
import { BaseFilter } from 'src/common/base.filter.dto';

export class InvoiceFilter extends BaseFilter {
  @ApiProperty({ required: false })
  userId: string;

  @ApiProperty({ required: false })
  subscriptionId: string;
}
