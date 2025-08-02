import { ApiProperty } from '@nestjs/swagger';
import { BaseFilter } from 'src/common/base.filter.dto';

export class SubscriptionsFilter extends BaseFilter {
  @ApiProperty({ required: false })
  isActive?: boolean;

  @ApiProperty({ required: false })
  userId?: string;

  @ApiProperty({ required: false })
  billingPlanId?: string;
}
