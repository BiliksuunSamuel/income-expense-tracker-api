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
import { ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  AccountRequest,
  AccountUpdate,
  AccountWithBalance,
} from 'src/dtos/account/account.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AuthUser } from 'src/extensions/auth.extensions';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { AccountService } from 'src/services/account.service';

@Controller('api/accounts')
@ApiTags('Accounts')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiResponse({ type: [AccountWithBalance] })
  @ApiQuery({ name: 'since', required: false })
  async getAccounts(
    @Query('since') since: string | undefined,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.accountService.getAccounts(user, since);
    response.status(res.code).send(res);
  }

  @Post()
  async createAccount(
    @Body() request: AccountRequest,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.accountService.createAccount(request, user);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  async updateAccount(
    @Param('id') id: string,
    @Body() changes: AccountUpdate,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.accountService.updateAccount(id, changes, user);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  async deleteAccount(
    @Param('id') id: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.accountService.deleteAccount(id, user);
    response.status(res.code).send(res);
  }
}
