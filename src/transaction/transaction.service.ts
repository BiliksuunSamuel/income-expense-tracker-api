import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { TransactionFilter } from 'src/dtos/transaction/transaction.filter.dto';
import { TransactionRequest } from 'src/dtos/transaction/transaction.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { ImageService } from 'src/providers/image.service';
import { TransactionRepository } from 'src/repositories/transaction.repository';
import { Transaction } from 'src/schemas/transaction.schema.dto';
import { convertFileExtensionToBase64FileType, generateId } from 'src/utils';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly imageService: ImageService,
  ) {}

  //get transaction for chart data by period
  async getTransactionForChart(
    user: UserJwtDetails,
    period: string,
  ): Promise<ApiResponseDto<{ type: string; amount: number }[]>> {
    try {
      this.logger.debug(
        'received request to get transaction for chart\n',
        user,
      );
      const transactions =
        await this.transactionRepository.getTransactionForChart(user, period);

      return CommonResponses.OkResponse(
        transactions,
        'Transaction for chart retrieved successfully',
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting transaction for chart\n',
        user,
        error,
      );
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while getting transaction for chart',
      );
    }
  }

  //get transaction revenue summary for income and expense by period
  async getTransactionRevenueSummary(
    user: UserJwtDetails,
    period: string,
  ): Promise<ApiResponseDto<any>> {
    try {
      this.logger.debug(
        'received request to get transaction revenue summary\n',
        user,
      );
      const transactions =
        await this.transactionRepository.getTransactionRevenueSummary(
          user,
          period,
        );

      return CommonResponses.OkResponse(
        transactions,
        'Transaction revenue summary retrieved successfully',
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting transaction revenue summary\n',
        user,
        error,
      );
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while getting transaction revenue summary',
      );
    }
  }

  //get transaction by id
  async getTransactionById(id: string): Promise<ApiResponseDto<Transaction>> {
    try {
      this.logger.debug('received request to get transaction by id\n', id);
      const transaction =
        await this.transactionRepository.getTransactionById(id);

      if (!transaction) {
        return CommonResponses.NotFoundResponse('Transaction not found');
      }

      return CommonResponses.OkResponse(
        transaction,
        'Transaction retrieved successfully',
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting transaction by id\n',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while getting transaction by id',
      );
    }
  }

  //filter transactions
  async getTransactions(
    filter: TransactionFilter,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<PagedResults<Transaction>>> {
    try {
      const transactions = await this.transactionRepository.getTransactions(
        filter,
        user,
      );

      this.logger.debug(
        'received request to get transactions\n',
        user,
        transactions.totalCount,
      );

      return CommonResponses.OkResponse(
        transactions,
        'Transactions retrieved successfully',
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting transactions\n',
        user,
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while getting transactions',
      );
    }
  }

  //create transaction
  async createTransaction(
    request: TransactionRequest,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<boolean>> {
    try {
      this.logger.debug('received request to creat transaction\n', user);
      const transaction: Transaction = {
        ...request,
        username: user.email,
        userId: user.id,
        createdAt: new Date(),
        createdBy: user.email,
        id: generateId(),
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        updatedAt: null,
        updatedBy: null,
      };

      if (request.invoice) {
        const base64String = `data:${convertFileExtensionToBase64FileType(request.invoiceFileType)};base64,${request.invoice}`;
        const invoice = await this.imageService.cloudinaryUpload(base64String);
        transaction.invoiceUrl = invoice?.secure_url;
      }

      await this.transactionRepository.createTransaction(transaction);

      return CommonResponses.OkResponse(true, 'Transaction added successfully');
    } catch (error) {
      this.logger.error(
        'an error occurred while creating transaction\n',
        user,
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while creating transaction',
      );
    }
  }
}
