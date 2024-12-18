import { ApiProperty } from '@nestjs/swagger';
import { FinancialReport } from './financial.report';

export class FinancialReportResponse {
  @ApiProperty({ type: [FinancialReport] })
  incomeReport: FinancialReport[];

  @ApiProperty()
  totalIncome: number;

  @ApiProperty({ type: [FinancialReport] })
  expenseReport: FinancialReport[];

  @ApiProperty()
  totalExpense: number;
}
