import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from '../services/reports.service';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { AuthUser } from 'src/extensions/auth.extensions';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { FinancialReportFilter } from 'src/dtos/common/financial.report.filter';
import { TransactionService } from 'src/services/transaction.service';
import { TransactionFilter } from 'src/dtos/transaction/transaction.filter.dto';

@Controller('api/reports')
@ApiTags('Reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly transactionService: TransactionService,
  ) {}

  //get financial report summary
  @Get('financial-report-summary')
  async getFinancialReportSummary(
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
    @Query() query: FinancialReportFilter,
  ) {
    const res = await this.reportsService.getFinancialReportSummaryAsync(
      user.id,
      query,
    );
    response.status(res.code).send(res);
  }

  @Get('export')
  async exportTransactions(
    @Query() filter: TransactionFilter,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.exportTransactionToFile(
      filter,
      user.id,
    );
    if (res.code !== 200) {
      return response.status(res.code).send(res);
    }
    response.setHeader('Content-Type', res.data.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=${res.data.fileName}`,
    );
    response.status(200).send(res);
  }
}
