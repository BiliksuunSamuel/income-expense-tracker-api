import { Injectable, Logger } from '@nestjs/common';
import { BaseActor } from './base.actor';
import { BudgetRepository } from 'src/repositories/budget.repository';
import { dispatch, spawnStateless } from 'nact';
import { Transaction } from 'src/schemas/transaction.schema';
import { NotificationsActor } from './notification.actor';
import { FcmNotificationRequest } from 'src/dtos/notification/fcm.notification.request.dto';
import { UserRepository } from 'src/repositories/user.repository';
import { Budget } from 'src/schemas/budget.schema';
import { budgetAlertFor, budgetAlertMessage } from 'src/utils/budget-alerts';

@Injectable()
export class BudgetActor extends BaseActor {
  private readonly logger = new Logger(BudgetActor.name);
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly notificationActor: NotificationsActor,
    private readonly userRepository: UserRepository,
  ) {
    super();
  }

  //do update budget details when transaction is updated;
  updateBudgetDetailsWhenTransactionDetailsIsUpdated = spawnStateless(
    this.system,
    async (msg: { budgetId: string; amount: number }, ctx) => {
      try {
        this.logger.debug(
          'received message to update budget details when transaction details is updated',
          msg,
        );
        const budgetId = msg.budgetId;
        const amount = msg.amount;
        const budget = await this.budgetRepository.getById(budgetId);
        if (!budget) {
          return;
        }

        const before = Number(budget.progressValue) || 0;
        budget.progressValue = amount;
        budget.limitExceeded = budget.progressValue > budget.amount;
        budget.updatedAt = new Date();
        if (!budget.createdAt) {
          budget.createdAt = new Date();
        }
        await this.budgetRepository.updateAsync(budget);

        await this.alertIfCrossed(budget, before);
      } catch (error) {
        this.logger.error(
          'an error occurred while processing budget update request',
          msg,
          ctx.name,
        );
      }
    },
  );

  //do update budget details when a transaction is added
  updateBudgetDetails = spawnStateless(
    this.system,
    async (msg: Transaction, ctx) => {
      try {
        this.logger.debug('received message to update budget details', msg);
        const budget = await this.budgetRepository.getById(msg.budgetId);
        if (!budget) {
          return;
        }

        const before = Number(budget.progressValue) || 0;
        budget.progressValue =
          parseFloat(budget.progressValue.toString()) +
          parseFloat(msg.amount.toString());
        budget.limitExceeded = budget.progressValue > budget.amount;
        budget.updatedAt = new Date();
        if (!budget.createdAt) {
          budget.createdAt = new Date();
        }
        const res = await this.budgetRepository.updateAsync(budget);

        await this.alertIfCrossed(budget, before);

        this.logger.debug('budget details updated successfully', res);
      } catch (error) {
        this.logger.error(
          'an error occurred while updating budget details',
          msg,
          error,
        );
      }
    },
  );

  /** Sends the owner a push when this change crossed the warning level or
   * the limit (once each, see [budgetAlertFor]). */
  private async alertIfCrossed(budget: Budget, before: number) {
    const kind = budgetAlertFor(budget, before, Number(budget.progressValue));
    if (!kind) return;
    const user = await this.userRepository.getByIdAsync(budget.createdBy);
    if (!user?.fcmToken) return;
    const message = budgetAlertMessage(kind, budget, user.currency);
    const request: FcmNotificationRequest = {
      token: user.fcmToken,
      notification: { title: message.title, body: message.body },
      data: message.data,
    };
    dispatch(this.notificationActor.sendFcmNotication, request);
  }
}
