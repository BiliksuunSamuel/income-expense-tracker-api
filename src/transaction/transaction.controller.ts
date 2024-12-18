import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth..guard';
import { TransactionService } from './transaction.service';
import { TransactionRequest } from 'src/dtos/transaction/transaction.request.dto';
import { Response } from 'express';
import { AuthUser } from 'src/extensions/auth.extensions';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { TransactionFilter } from 'src/dtos/transaction/transaction.filter.dto';
import { Transaction } from 'src/schemas/transaction.schema.dto';
import { GroupedTransactionDto } from 'src/dtos/transaction/grouped.transaction.dto';

@Controller('api/transactions')
@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

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
}
