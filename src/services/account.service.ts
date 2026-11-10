import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import {
  AccountRequest,
  AccountUpdate,
  AccountWithBalance,
} from 'src/dtos/account/account.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AccountKind } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { AccountRepository } from 'src/repositories/account.repository';
import { Account } from 'src/schemas/account.schema';
import { generateId } from 'src/utils';
import { withBalances } from 'src/utils/accounts';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly accountRepository: AccountRepository) {}

  /** The user's accounts with balances. The first call creates a "Cash"
   * account and moves their earlier transactions into it. */
  async getAccounts(
    user: UserJwtDetails,
    since?: string,
  ): Promise<ApiResponseDto<AccountWithBalance[]>> {
    try {
      const accounts = await this.ensureAccounts(user);
      const sinceDate = since ? new Date(since) : null;
      const [totals, before] = await Promise.all([
        this.accountRepository.totals(user.id),
        sinceDate && !isNaN(sinceDate.getTime())
          ? this.accountRepository.totals(user.id, sinceDate)
          : Promise.resolve(undefined),
      ]);
      return CommonResponses.OkResponse(withBalances(accounts, totals, before));
    } catch (error) {
      this.logger.error('could not get accounts', user.id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while getting accounts',
      );
    }
  }

  async createAccount(
    request: AccountRequest,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Account>> {
    try {
      if (request.id) {
        const owner = await this.accountRepository.ownerOf(request.id);
        if (owner === user.id) {
          const existing = await this.accountRepository.byId(
            request.id,
            user.id,
          );
          return CommonResponses.OkResponse(existing, 'Account already saved');
        }
        if (owner) {
          return CommonResponses.ConflictResponse(
            'An account with this id already exists',
          );
        }
      }
      const existing = await this.ensureAccounts(user);
      const account = this.newAccount(user, {
        id: request.id,
        name: request.name.trim(),
        kind: request.kind,
        openingBalance: request.openingBalance ?? 0,
        isDefault: existing.length === 0,
      });
      await this.accountRepository.create(account);
      return CommonResponses.CreatedResponse(account, 'Account added');
    } catch (error) {
      this.logger.error('could not create account', user.id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while adding the account',
      );
    }
  }

  async updateAccount(
    id: string,
    changes: AccountUpdate,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Account>> {
    try {
      const account = await this.accountRepository.byId(id, user.id);
      if (!account)
        return CommonResponses.NotFoundResponse('Account not found');
      if (changes.archived && (changes.isDefault ?? account.isDefault)) {
        return CommonResponses.BadRequestResponse(
          null,
          'Choose another default account before archiving this one',
        );
      }
      const { isDefault, ...rest } = changes;
      const updated = await this.accountRepository.update(id, user.id, {
        ...rest,
        ...(rest.name && { name: rest.name.trim() }),
        updatedAt: new Date(),
        updatedBy: user.email,
      });
      if (isDefault) await this.accountRepository.setDefault(id, user.id);
      return CommonResponses.OkResponse(
        { ...updated, isDefault: isDefault ?? updated.isDefault },
        'Account updated',
      );
    } catch (error) {
      this.logger.error('could not update account', id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while updating the account',
      );
    }
  }

  /** Only an unused account can be deleted; one with history is archived. */
  async deleteAccount(
    id: string,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Account>> {
    try {
      const account = await this.accountRepository.byId(id, user.id);
      if (!account)
        return CommonResponses.NotFoundResponse('Account not found');
      if (account.isDefault) {
        return CommonResponses.BadRequestResponse(
          null,
          'Choose another default account before deleting this one',
        );
      }
      if (await this.accountRepository.isUsed(id, user.id)) {
        return CommonResponses.ConflictResponse(
          'This account has transactions. Archive it instead.',
        );
      }
      const deleted = await this.accountRepository.delete(id, user.id);
      return CommonResponses.OkResponse(deleted, 'Account deleted');
    } catch (error) {
      this.logger.error('could not delete account', id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while deleting the account',
      );
    }
  }

  /** Account id → name, for exports. */
  async accountNames(userId: string): Promise<Map<string, string>> {
    const accounts = await this.accountRepository.list(userId);
    return new Map(accounts.map((a) => [a.id, a.name]));
  }

  /** The account a transaction belongs to: [requested] if it is one of the
   * user's, otherwise their default (older apps send "Default"). */
  async resolveAccountId(
    user: UserJwtDetails,
    requested?: string,
  ): Promise<string> {
    const accounts = await this.ensureAccounts(user);
    if (requested && accounts.some((a) => a.id === requested)) {
      return requested;
    }
    return (accounts.find((a) => a.isDefault) ?? accounts[0]).id;
  }

  /** The user's accounts, creating "Cash" (default) for a user who has
   * none and moving their earlier transactions into it. */
  async ensureAccounts(user: UserJwtDetails): Promise<Account[]> {
    const accounts = await this.accountRepository.list(user.id);
    if (accounts.length > 0) return accounts;
    const cash = this.newAccount(user, {
      name: 'Cash',
      kind: AccountKind.Cash,
      openingBalance: 0,
      isDefault: true,
    });
    await this.accountRepository.create(cash);
    const moved = await this.accountRepository.adoptOrphanTransactions(
      user.id,
      cash.id,
      [cash.id],
    );
    this.logger.log(`created Cash for ${user.id}; moved ${moved} transactions`);
    return [cash];
  }

  private newAccount(
    user: UserJwtDetails,
    fields: Pick<Account, 'name' | 'kind' | 'openingBalance' | 'isDefault'> & {
      id?: string;
    },
  ): Account {
    return {
      ...fields,
      id: fields.id ?? generateId(),
      userId: user.id,
      archived: false,
      createdAt: new Date(),
      createdBy: user.email,
      updatedAt: null,
      updatedBy: null,
    };
  }
}
