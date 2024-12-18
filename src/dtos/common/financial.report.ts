import { ApiProperty } from '@nestjs/swagger';

export class FinancialReport {
  @ApiProperty()
  label: string;
  @ApiProperty()
  value: number;
}
