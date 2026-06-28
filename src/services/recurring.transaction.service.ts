import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { dispatch } from 'nact';
import { BudgetActor } from 'src/actors/budget.actor';
import { NotificationsActor } from 'src/actors/notification.actor';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { EmailRequest } from 'src/dtos/notification/email.request.dto';
import { FcmNotificationRequest } from 'src/dtos/notification/fcm.notification.request.dto';
import { RecurringTransactionResponse } from 'src/dtos/recurring-transaction/recurring.transaction.response.dto';
import { RecurringTransactionUpdate } from 'src/dtos/recurring-transaction/recurring.transaction.update.dto';
import {
  RecurringTransactionStatus,
  TransactionRepeatFrequency,
  TransactionType,
} from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { RecurringTransactionRepository } from 'src/repositories/recurring.transaction.repository';
import { TransactionRepository } from 'src/repositories/transaction.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { RecurringTransaction } from 'src/schemas/recurring.transaction.schema';
import { Transaction } from 'src/schemas/transaction.schema';
import { generateId } from 'src/utils';

@Injectable()
export class RecurringTransactionService {
  private readonly logger = new Logger(RecurringTransactionService.name);

  constructor(
    private readonly repository: RecurringTransactionRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetActor: BudgetActor,
    private readonly notificationActor: NotificationsActor,
    private readonly userRepository: UserRepository,
  ) {}

  /// Called right after a transaction with `repeatTransaction = true` is saved.
  async createFromTransaction(transaction: Transaction): Promise<void> {
    try {
      const frequency = transaction.repeatFrequency;
      if (!frequency) {
        this.logger.warn(
          'repeat transaction has no frequency; skipping recurring',
          transaction.id,
        );
        return;
      }
      const interval =
        transaction.repeatInterval && transaction.repeatInterval > 0
          ? transaction.repeatInterval
          : 1;
      const base = transaction.createdAt
        ? new Date(transaction.createdAt)
        : new Date();
      const nextRunAt = this.computeNextRun(base, frequency, interval);
      const repeatUntil = transaction.repeatTransactionEndDate
        ? new Date(transaction.repeatTransactionEndDate)
        : null;

      // Already past the end date → nothing to schedule.
      if (repeatUntil && nextRunAt > repeatUntil) return;

      const recurring: RecurringTransaction = {
        id: generateId(),
        createdAt: new Date(),
        createdBy: transaction.username,
        updatedAt: null,
        updatedBy: null,
        userId: transaction.userId,
        username: transaction.username,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        category: transaction.category,
        description: transaction.description,
        account: transaction.account,
        budgetId: transaction.budgetId,
        frequency,
        interval,
        repeatUntil,
        nextRunAt,
        lastRunAt: null,
        status: RecurringTransactionStatus.Active,
      };
      await this.repository.create(recurring);
      this.logger.debug('created recurring transaction', recurring.id);
    } catch (error) {
      this.logger.error(
        'failed to create recurring transaction',
        error,
        transaction?.id,
      );
    }
  }

  async getUserRecurringTransactions(
    userId: string,
  ): Promise<ApiResponseDto<RecurringTransactionResponse[]>> {
    try {
      const items = await this.repository.getByUser(userId);
      const response: RecurringTransactionResponse[] = items.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount,
        currency: r.currency,
        category: r.category,
        description: r.description,
        budgetId: r.budgetId,
        frequency: r.frequency,
        interval: r.interval,
        repeatUntil: r.repeatUntil,
        nextRunAt: r.nextRunAt,
        lastRunAt: r.lastRunAt,
        status: r.status,
        createdAt: r.createdAt,
      }));
      return CommonResponses.OkResponse(
        response,
        'Recurring transactions retrieved successfully',
      );
    } catch (error) {
      this.logger.error('failed to get recurring transactions', error, userId);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while retrieving recurring transactions',
      );
    }
  }

  /// Updates the editable fields (amount, description) of a recurring template.
  async updateRecurringTransaction(
    id: string,
    userId: string,
    update: RecurringTransactionUpdate,
  ): Promise<ApiResponseDto<boolean>> {
    try {
      const existing = await this.repository.getById(id);
      if (!existing || existing.userId !== userId) {
        return CommonResponses.NotFoundResponse(
          'Recurring transaction not found',
        );
      }
      const patch: Partial<RecurringTransaction> = { updatedAt: new Date() };
      if (update.amount !== undefined && update.amount !== null) {
        patch.amount = update.amount;
      }
      if (update.description !== undefined) {
        patch.description = update.description;
      }
      await this.repository.update(id, patch);
      return CommonResponses.OkResponse(true, 'Recurring transaction updated');
    } catch (error) {
      this.logger.error('failed to update recurring transaction', error, id);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while updating the recurring transaction',
      );
    }
  }

  async closeRecurringTransaction(
    id: string,
    userId: string,
  ): Promise<ApiResponseDto<boolean>> {
    try {
      const existing = await this.repository.getById(id);
      if (!existing || existing.userId !== userId) {
        return CommonResponses.NotFoundResponse(
          'Recurring transaction not found',
        );
      }
      await this.repository.update(id, {
        status: RecurringTransactionStatus.Closed,
        updatedAt: new Date(),
      });
      return CommonResponses.OkResponse(true, 'Recurring transaction closed');
    } catch (error) {
      this.logger.error('failed to close recurring transaction', error, id);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while closing the recurring transaction',
      );
    }
  }

  // ──────────────────────────────── Scheduler ────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async processDueRecurringTransactions(): Promise<void> {
    const now = new Date();
    try {
      // Close anything that's already past its end date.
      const expired = await this.repository.getExpired(now);
      for (const r of expired) {
        await this.repository.update(r.id, {
          status: RecurringTransactionStatus.Closed,
          updatedAt: now,
        });
      }

      const due = await this.repository.getDue(now);
      if (due.length) {
        this.logger.debug(`processing ${due.length} due recurring transactions`);
      }
      for (const r of due) {
        await this.generateTransaction(r, now);
        const next = this.computeNextRun(
          new Date(r.nextRunAt),
          r.frequency,
          r.interval,
        );
        const patch: Partial<RecurringTransaction> = {
          lastRunAt: now,
          nextRunAt: next,
          updatedAt: now,
        };
        if (r.repeatUntil && next > new Date(r.repeatUntil)) {
          patch.status = RecurringTransactionStatus.Closed;
        }
        await this.repository.update(r.id, patch);
      }
    } catch (error) {
      this.logger.error('failed processing due recurring transactions', error);
    }
  }

  private async generateTransaction(
    r: RecurringTransaction,
    now: Date,
  ): Promise<void> {
    const transaction: Transaction = {
      id: generateId(),
      createdAt: now,
      createdBy: r.username,
      updatedAt: null,
      updatedBy: null,
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      category: r.category,
      description: r.description,
      account: r.account,
      budgetId: r.budgetId,
      userId: r.userId,
      username: r.username,
      month: now.getMonth(),
      year: now.getFullYear(),
      repeatTransaction: false,
      repeatInterval: 0,
      repeatTransactionEndDate: null,
      repeatFrequency: null,
      invoiceUrl: null,
      invoiceFileName: null,
      invoiceFileType: null,
      invoiceId: null,
      subscriptionId: null,
    };
    await this.transactionRepository.createTransaction(transaction);
    if (transaction.budgetId) {
      dispatch(this.budgetActor.updateBudgetDetails, transaction);
    }
    await this.notifyUser(r, transaction);
  }

  /// Notifies the user that a recurring transaction was processed and a
  /// transaction was created on their behalf — via push (FCM) and email.
  /// The two channels are independent: a user with only an email still gets
  /// notified, and vice versa.
  private async notifyUser(
    r: RecurringTransaction,
    transaction: Transaction,
  ): Promise<void> {
    try {
      const user = await this.userRepository.getByIdAsync(r.userId);
      if (!user) {
        return;
      }

      const amount = `${transaction.currency ?? ''}${transaction.amount.toFixed(2)}`;
      const verb =
        transaction.type === TransactionType.Income ? 'added' : 'recorded';
      const title = 'Recurring Transaction Processed';
      const message = `Your recurring ${transaction.type.toLowerCase()} of ${amount} for ${transaction.category} has been ${verb} automatically.`;

      //push notification
      if (user.fcmToken?.length > 0) {
        const fcmRequest: FcmNotificationRequest = {
          token: user.fcmToken,
          notification: {
            title,
            body: `🔁 ${message}`,
          },
          data: {
            type: 'recurring_transaction',
            transactionId: transaction.id,
            recurringTransactionId: r.id,
          },
        };
        dispatch(this.notificationActor.sendFcmNotication, fcmRequest);
      }

      //email notification
      if (user.email?.length > 0) {
        const greeting = user.firstName ? `Hi ${user.firstName},` : 'Hi,';
        const emailRequest: EmailRequest = {
          to: user.email,
          subject: title,
          text: `${greeting} ${message}`,
          html: `<p>${greeting}</p><p>🔁 ${message}</p><p>You can review it anytime in your transactions.</p>`,
        };
        dispatch(this.notificationActor.emailNotificationActor, emailRequest);
      }
    } catch (error) {
      this.logger.error(
        'failed to send recurring transaction notification',
        error,
        r.id,
      );
    }
  }

  private computeNextRun(
    base: Date,
    frequency: TransactionRepeatFrequency,
    interval: number,
  ): Date {
    const d = new Date(base);
    const n = interval && interval > 0 ? interval : 1;
    switch (frequency) {
      case TransactionRepeatFrequency.Daily:
        d.setDate(d.getDate() + n);
        break;
      case TransactionRepeatFrequency.Weekly:
        d.setDate(d.getDate() + n * 7);
        break;
      case TransactionRepeatFrequency.Monthly:
        d.setMonth(d.getMonth() + n);
        break;
      case TransactionRepeatFrequency.Yearly:
        d.setFullYear(d.getFullYear() + n);
        break;
      default:
        d.setMonth(d.getMonth() + n);
    }
    return d;
  }
}
