import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { TransactionRequest } from 'src/dtos/transaction/transaction.request.dto';
import { Response } from 'express';
import { AuthUser } from 'src/extensions/auth.extensions';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { TransactionFilter } from 'src/dtos/transaction/transaction.filter.dto';
import { Transaction } from 'src/schemas/transaction.schema';
import { GroupedTransactionDto } from 'src/dtos/transaction/grouped.transaction.dto';
import { TransactionService } from 'src/services/transaction.service';

@Controller('api/transactions')
@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  //export transactions
  @Get('export')
  @ApiResponse({ type: Transaction })
  async exportTransactions(
    @Query() filter: TransactionFilter,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.exportTransactions(filter, user);
    //prepare pdf report file
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=transactions-${new Date().toISOString()}.pdf`,
    );
    response.send(res);
  }

  //get transactions for budget
  @Get('budget/:id')
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ type: [Transaction] })
  async getTransactionsForBudget(
    @Param('id') id: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.getTransactionsForBudget(
      id,
      user.id,
    );
    response.status(res.code).send(res);
  }
  //update transaction
  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  async updateTransaction(
    @Param('id') id: string,
    @Body() request: TransactionRequest,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.updateTransaction(
      id,
      request,
      user,
    );
    response.status(res.code).send(res);
  }

  //get grouped transactions
  @Get('grouped')
  @ApiResponse({ type: GroupedTransactionDto })
  async getGroupedTransactions(
    @Query() filter: TransactionFilter,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.getGroupedTransactions(
      filter,
      user,
    );
    response.status(res.code).send(res);
  }

  //get transaction revenue summary for income and expense by period
  @Get('summary')
  @ApiResponse({ type: Transaction })
  async getTransactionRevenueSummary(
    @Query('period') period: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.getTransactionRevenueSummary(
      user,
      period,
    );
    response.status(res.code).send(res);
  }

  //get transaction for chart data by period
  @Get('chart')
  @ApiResponse({ type: Transaction })
  async getTransactionForChart(
    @Query('period') period: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.getTransactionForChart(
      user,
      period,
    );
    response.status(res.code).send(res);
  }

  //get transaction by id
  @Get(':id')
  @ApiResponse({ type: Transaction })
  @ApiParam({ name: 'id', type: String })
  async getTransactionById(@Res() response: Response, @Param('id') id: string) {
    const res = await this.transactionService.getTransactionById(id);
    response.status(res.code).send(res);
  }
  //get transactions
  @Get()
  @ApiResponse({ type: Transaction })
  async getTransactions(
    @Query() filter: TransactionFilter,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.getTransactions(filter, user);
    response.status(res.code).send(res);
  }

  //create transaction
  @Post()
  async createTransaction(
    @Body() request: TransactionRequest,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transactionService.createTransaction(request, user);
    response.status(res.code).send(res);
  }

  //delete transaction
  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  async deleteTransaction(@Param('id') id: string, @Res() response: Response) {
    const res = await this.transactionService.deleteTransaction(id);
    response.status(res.code).send(res);
  }
}
