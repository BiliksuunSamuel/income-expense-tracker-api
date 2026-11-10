import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { TransferRequest } from 'src/dtos/transfer/transfer.request.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { Transfer } from 'src/schemas/transfer.schema';
import { TransferService } from 'src/services/transfer.service';

@Controller('api/transfers')
@ApiTags('Transfers')
@UseGuards(JwtAuthGuard)
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Get()
  @ApiResponse({ type: [Transfer] })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'since', required: false })
  async getTransfers(
    @Query('accountId') accountId: string | undefined,
    @Query('since') since: string | undefined,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transferService.getTransfers(user, accountId, since);
    response.status(res.code).send(res);
  }

  @Post()
  async createTransfer(
    @Body() request: TransferRequest,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transferService.createTransfer(request, user);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  async deleteTransfer(
    @Param('id') id: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.transferService.deleteTransfer(id, user);
    response.status(res.code).send(res);
  }
}
