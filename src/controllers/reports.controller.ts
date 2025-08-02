import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from '../services/reports.service';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { AuthUser } from 'src/extensions/auth.extensions';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { FinancialReportFilter } from 'src/dtos/common/financial.report.filter';

@Controller('api/reports')
@ApiTags('Reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
}
