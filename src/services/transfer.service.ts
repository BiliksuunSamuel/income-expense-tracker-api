import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { TransferRequest } from 'src/dtos/transfer/transfer.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { AccountRepository } from 'src/repositories/account.repository';
import { TransferRepository } from 'src/repositories/transfer.repository';
import { Transfer } from 'src/schemas/transfer.schema';
import { generateId } from 'src/utils';
import { dateOrNow, round2 } from 'src/utils/accounts';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly transferRepository: TransferRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async getTransfers(
    user: UserJwtDetails,
    accountId?: string,
    since?: string,
  ): Promise<ApiResponseDto<Transfer[]>> {
    try {
      const res = await this.transferRepository.list(
        user.id,
        accountId,
        since ? dateOrNow(since) : undefined,
      );
      return CommonResponses.OkResponse(res);
    } catch (error) {
      this.logger.error('could not get transfers', user.id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while getting transfers',
      );
    }
  }

  async createTransfer(
    request: TransferRequest,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<boolean>> {
    try {
      if (request.id) {
        const owner = await this.transferRepository.ownerOf(request.id);
        if (owner === user.id) {
          return CommonResponses.OkResponse(true, 'Transfer already saved');
        }
        if (owner) {
          return CommonResponses.ConflictResponse(
            'A transfer with this id already exists',
          );
        }
      }
      if (request.fromAccountId === request.toAccountId) {
        return CommonResponses.BadRequestResponse(
          false,
          'Choose two different accounts',
        );
      }
      const [from, to] = await Promise.all([
        this.accountRepository.byId(request.fromAccountId, user.id),
        this.accountRepository.byId(request.toAccountId, user.id),
      ]);
      if (!from || !to) {
        return CommonResponses.NotFoundResponse('Account not found');
      }
      const when = dateOrNow(request.date);
      await this.transferRepository.create({
        id: request.id ?? generateId(),
        userId: user.id,
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: round2(request.amount),
        note: request.note?.trim() ?? '',
        createdAt: when,
        createdBy: user.email,
        updatedAt: null,
        updatedBy: null,
      });
      return CommonResponses.OkResponse(true, 'Transfer saved');
    } catch (error) {
      this.logger.error('could not create transfer', user.id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while saving the transfer',
      );
    }
  }

  async deleteTransfer(
    id: string,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Transfer>> {
    try {
      const res = await this.transferRepository.delete(id, user.id);
      if (!res) return CommonResponses.NotFoundResponse('Transfer not found');
      return CommonResponses.OkResponse(res, 'Transfer deleted');
    } catch (error) {
      this.logger.error('could not delete transfer', id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while deleting the transfer',
      );
    }
  }
}
