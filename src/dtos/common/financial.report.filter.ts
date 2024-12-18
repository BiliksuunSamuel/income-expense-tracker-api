import { ApiProperty } from '@nestjs/swagger';

export class FinancialReportFilter {
  @ApiProperty({ required: false, default: null })
  startDate?: Date;

  @ApiProperty({ required: false, default: null })
  endDate?: Date;
}
