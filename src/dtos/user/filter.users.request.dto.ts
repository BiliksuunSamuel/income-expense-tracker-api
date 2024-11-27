import { ApiProperty } from '@nestjs/swagger';
import { BaseFilter } from 'src/common/base.filter.dto';

export class FilterUsersRequest extends BaseFilter {
  @ApiProperty({ required: false })
  email: string;

  @ApiProperty({ required: false })
  phoneNumber: string;

  @ApiProperty({ required: false })
  region: string;

  @ApiProperty({ required: false })
  constituencyCode: string;
}
