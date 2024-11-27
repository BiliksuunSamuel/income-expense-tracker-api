import { ApiProperty } from '@nestjs/swagger';

export class BaseFilter {
  @ApiProperty({ required: false })
  page: number;

  @ApiProperty({ required: false })
  query: string;

  @ApiProperty({ required: false })
  pageSize: number;
}
