import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { RecurringTransactionUpdate } from 'src/dtos/recurring-transaction/recurring.transaction.update.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { RecurringTransactionService } from 'src/services/recurring.transaction.service';

@Controller('api/recurring-transactions')
@ApiTags('Recurring Transactions')
@UseGuards(JwtAuthGuard)
export class RecurringTransactionsController {
  constructor(
    private readonly recurringTransactionService: RecurringTransactionService,
  ) {}

  //list the user's recurring transactions
  @Get()
  async getRecurringTransactions(
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res =
      await this.recurringTransactionService.getUserRecurringTransactions(
        user.id,
      );
    response.status(res.code).send(res);
  }

  //update editable fields (amount, description)
  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  async updateRecurringTransaction(
    @Param('id') id: string,
    @Body() body: RecurringTransactionUpdate,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.recurringTransactionService.updateRecurringTransaction(
      id,
      user.id,
      body,
    );
    response.status(res.code).send(res);
  }

  //close (end) a recurring transaction
  @Patch(':id/close')
  @ApiParam({ name: 'id', type: String })
  async closeRecurringTransaction(
    @Param('id') id: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res =
      await this.recurringTransactionService.closeRecurringTransaction(
        id,
        user.id,
      );
    response.status(res.code).send(res);
  }
}
