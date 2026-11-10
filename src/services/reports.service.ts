import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { FinancialReportFilter } from 'src/dtos/common/financial.report.filter';
import { FinancialReportResponse } from 'src/dtos/common/financial.report.response';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { ReportsRepository } from 'src/repositories/reports.repository';
import { MonthlyCategoryTotal } from 'src/dtos/reports/monthly.totals.dto';
import { monthCount, startOfMonths, utcOffset } from 'src/utils/monthly-totals';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  constructor(private readonly reportsRepository: ReportsRepository) {}

  //get financial report summary
  async getFinancialReportSummaryAsync(
    userId: string,
    filter: FinancialReportFilter,
  ): Promise<ApiResponseDto<FinancialReportResponse>> {
    try {
      this.logger.debug(
        'request to get financial report summary',
        userId,
        filter,
      );
      const response =
        await this.reportsRepository.getFinancialReportSummaryAsync(
          userId,
          filter,
        );
      this.logger.debug(
        'financial report summary retrieved successfully',
        response,
      );
      return CommonResponses.OkResponse(response);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting financial report summary',
        error,
      );
      return CommonResponses.InternalServerErrorResponse<FinancialReportResponse>();
    }
  }

  /** Each category's total per month for the last [months] months
   * (this one included), for insights on the phone. */
  async monthlyTotals(
    userId: string,
    months: unknown,
    offset: unknown,
  ): Promise<ApiResponseDto<MonthlyCategoryTotal[]>> {
    try {
      const zone = utcOffset(offset);
      const from = startOfMonths(new Date(), monthCount(months), zone);
      return CommonResponses.OkResponse(
        await this.reportsRepository.monthlyTotals(userId, from, zone),
      );
    } catch (error) {
      this.logger.error('could not get monthly totals', userId, error);
      return CommonResponses.InternalServerErrorResponse<
        MonthlyCategoryTotal[]
      >();
    }
  }
}
