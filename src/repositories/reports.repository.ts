import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinancialReportFilter } from 'src/dtos/common/financial.report.filter';
import { FinancialReportResponse } from 'src/dtos/common/financial.report.response';
import { Transaction } from 'src/schemas/transaction.schema.dto';

@Injectable()
export class ReportsRepository {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionsRepository: Model<Transaction>,
  ) {}

  //get financial report summary
  async getFinancialReportSummaryAsync(
    userId: string,
    filter: FinancialReportFilter,
  ): Promise<FinancialReportResponse> {
    //get report from transactions of type=Expense grouped by category

    let startDate = null;
    let endDate = null;
    if (filter.startDate && filter.startDate.toString().length > 0) {
      startDate = new Date(filter.startDate);
      startDate.setHours(0, 0, 0, 0);
    }
    if (filter.endDate && filter.endDate.toString().length > 0) {
      endDate = new Date(filter.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const expenseMatch: any = {
      type: 'Expense',
      userId,
    };
    if (startDate && endDate) {
      expenseMatch.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const expenseReport = await this.transactionsRepository.aggregate([
      {
        $match: expenseMatch,
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
    ]);

    const incomeMatch: any = {
      type: 'Income',
      userId,
    };
    if (startDate && endDate) {
      incomeMatch.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    //get report from transactions of type=Income grouped by category
    const incomeReport = await this.transactionsRepository.aggregate([
      {
        $match: incomeMatch,
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
    ]);

    //get total income
    const totalIncome = incomeReport.reduce((acc, cur) => acc + cur.total, 0);

    //get total expense
    const totalExpense = expenseReport.reduce((acc, cur) => acc + cur.total, 0);

    //format response
    const response: FinancialReportResponse = {
      totalIncome,
      totalExpense,
      expenseReport: expenseReport.map((item) => ({
        label: item._id,
        value: item.total,
      })),
      incomeReport: incomeReport.map((item) => ({
        label: item._id,
        value: item.total,
      })),
    };

    return response;
  }
}
