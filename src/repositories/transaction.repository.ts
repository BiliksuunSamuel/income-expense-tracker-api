import { literalPattern, transactionQuery } from 'src/utils/transaction-query';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PagedResults } from 'src/common/paged.results.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { GroupedTransactionDto } from 'src/dtos/transaction/grouped.transaction.dto';
import { TransactionFilter } from 'src/dtos/transaction/transaction.filter.dto';
import { TransactionFilterPeriod } from 'src/enums';
import { Transaction } from 'src/schemas/transaction.schema';
import { convertTransactionFilterPeriodToDateTimeRange } from 'src/utils';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionRepository: Model<Transaction>,
  ) {}

  //get total transactions amount for budget
  async getTotalTransactionsAmountForBudget(
    budgetId: string,
    userId: string,
  ): Promise<number> {
    const transactions = await this.transactionRepository
      .find({ $and: [{ budgetId }, { userId }] })
      .lean();
    const totalAmount = transactions.reduce(
      (acc, item) => acc + item.amount,
      0,
    );
    return totalAmount;
  }

  //get transactions for budget
  async getTransactionsForBudget(
    budgetId: string,
    userId: string,
  ): Promise<Transaction[]> {
    const transactions = await this.transactionRepository
      .find({ $and: [{ budgetId }, { userId }] })
      .sort({ createdAt: -1 })
      .lean();
    return transactions;
  }

  //get grouped transactions
  async getGroupedTransactions(
    filter: TransactionFilter,
    user: UserJwtDetails,
  ): Promise<GroupedTransactionDto> {
    const query: any = {
      userId: user.id,
    };
    if (filter.currency) {
      query.currency = filter.currency;
    }
    if (filter.category) {
      query.category = filter.category;
    }
    if (filter.type) {
      query.type = filter.type;
    }
    if (filter.repeatTransaction != null) {
      query.repeatTransaction = filter.repeatTransaction;
    }
    if (typeof filter.query === 'string' && filter.query.trim()) {
      const pattern = literalPattern(filter.query.trim().slice(0, 100));
      query.$or = [{ category: pattern }, { description: pattern }];
    }
    if (filter.period) {
      const { startDate, endDate } =
        convertTransactionFilterPeriodToDateTimeRange(filter.period);
      query.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayTransactions = await this.transactionRepository
      .find({
        ...query,
        createdAt: {
          $gte: today.setHours(0, 0, 0, 0),
          $lte: today.setHours(23, 59, 59, 999),
        },
        userId: user.id,
      })
      .sort({ createdAt: -1 })
      .lean();
    const yesterdayTransactions = await this.transactionRepository
      .find({
        ...query,
        createdAt: {
          $gte: yesterday.setHours(0, 0, 0, 0),
          $lte: yesterday.setHours(23, 59, 59, 999),
        },
        userId: user.id,
      })
      .sort({ createdAt: -1 })
      .lean();
    return {
      today: todayTransactions,
      yesterday: yesterdayTransactions,
    };
  }

  //get transaction for chart data by period
  async getTransactionForChart(
    user: UserJwtDetails,
    period: string,
  ): Promise<{ type: string; amount: number }[]> {
    const { startDate, endDate } =
      convertTransactionFilterPeriodToDateTimeRange(
        period as TransactionFilterPeriod,
      );
    const transactions = await this.transactionRepository
      .find({
        userId: user.id,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .select('type amount')
      .lean();
    return transactions.map((item) => ({
      type: item.type,
      amount: item.amount,
    }));
  }

  //get transaction revenue summary for income and expense by period
  //{"expense": 0, "income": 0}
  async getTransactionRevenueSummary(
    user: UserJwtDetails,
    period: string,
  ): Promise<{ income: number; expense: number }> {
    const { startDate, endDate } =
      convertTransactionFilterPeriodToDateTimeRange(
        period as TransactionFilterPeriod,
      );
    const transactions = await this.transactionRepository
      .aggregate([
        {
          $match: {
            userId: user.id,
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
          },
        },
      ])
      .exec();
    const res = {
      income: 0,
      expense: 0,
    };
    transactions.forEach((item) => {
      if (item._id === 'Income') {
        res.income = parseFloat(item.total.toFixed(3));
      } else {
        res.expense = parseFloat(item.total.toFixed(3));
      }
    });
    return res;
  }

  async createTransaction(transaction: Transaction): Promise<boolean> {
    await this.transactionRepository.create(transaction);
    return true;
  }

  async getTransactionsForExport(
    filter: TransactionFilter,
    user: UserJwtDetails,
  ): Promise<Transaction[]> {
    const query: any = transactionQuery(filter, user.id);
    if (filter.period) {
      const { startDate, endDate } =
        convertTransactionFilterPeriodToDateTimeRange(filter.period);
      query.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }
    const data = await this.transactionRepository
      .find(query)
      .sort({ createdAt: -1 })
      .lean();

    return data;
  }

  async getTransactions(
    filter: TransactionFilter,
    user: UserJwtDetails,
  ): Promise<PagedResults<Transaction>> {
    const query: any = transactionQuery(filter, user.id);
    if (filter.period && filter.period.length > 1) {
      const { startDate, endDate } =
        convertTransactionFilterPeriodToDateTimeRange(filter.period);
      query.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }
    const page = Math.max(1, Math.floor(Number(filter.page) || 1));
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(Number(filter.pageSize) || 10)),
    );
    filter.page = page;
    filter.pageSize = pageSize;
    const totalCount = await this.transactionRepository.countDocuments(query);
    const data = await this.transactionRepository
      .find(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .lean();

    const res: PagedResults<Transaction> = {
      totalCount,
      totalPages: Math.ceil(totalCount / filter.pageSize),
      results: data,
      page: filter.page,
      pageSize: filter.pageSize,
    };

    return res;
  }

  async getTransactionById(
    transactionId: string,
    userId: string,
  ): Promise<Transaction> {
    const doc = await this.transactionRepository
      .findOne({ id: transactionId, userId })
      .lean();
    return doc;
  }

  /** Who owns [transactionId], if it exists at all (any user). */
  async getTransactionOwner(transactionId: string): Promise<string | null> {
    const doc = await this.transactionRepository
      .findOne({ id: transactionId }, { userId: 1 })
      .lean();
    return doc?.userId ?? null;
  }

  async updateTransaction(
    transactionId: string,
    userId: string,
    transaction: Transaction,
  ): Promise<Transaction> {
    const { _id, ...rest } = transaction as any;
    const doc = await this.transactionRepository
      .findOneAndUpdate({ id: transactionId, userId }, rest, { new: true })
      .lean();
    return doc;
  }

  async deleteTransaction(
    transactionId: string,
    userId: string,
  ): Promise<Transaction> {
    const doc = await this.transactionRepository
      .findOneAndDelete({ id: transactionId, userId })
      .lean();
    return doc;
  }
}
