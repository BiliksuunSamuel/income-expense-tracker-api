import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { FinancialReportFilter } from 'src/dtos/common/financial.report.filter';
import { FinancialReportResponse } from 'src/dtos/common/financial.report.response';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { ReportsRepository } from 'src/repositories/reports.repository';

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
}
