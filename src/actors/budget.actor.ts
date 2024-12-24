import { Injectable, Logger } from '@nestjs/common';
import { BaseActor } from './base.actor';
import { BudgetRepository } from 'src/repositories/budget.repository';
import { dispatch, spawnStateless } from 'nact';
import { Transaction } from 'src/schemas/transaction.schema.dto';
import { NotificationsActor } from './notification.actor';
import { FcmNotificationRequest } from 'src/dtos/notification/fcm.notification.request.dto';
import { UserRepository } from 'src/repositories/user.repository';

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

        budget.progressValue = amount;
        budget.limitExceeded = budget.progressValue > budget.amount;
        budget.updatedAt = new Date();
        if (!budget.createdAt) {
          budget.createdAt = new Date();
        }
        await this.budgetRepository.updateAsync(budget);

        //handle processing notification
        const progressPercentage = (budget.progressValue / budget.amount) * 100;
        const notificationPercentage =
          parseFloat(budget.receiveAlertPercentage.toString()) * 100;

        //notification params;
        const fcmRequest: FcmNotificationRequest = {
          notification: {},
          data: {},
          token: '',
        };
        if (
          progressPercentage >= notificationPercentage &&
          !budget.limitExceeded
        ) {
          //send notification about progress
          fcmRequest.notification.title = 'Budget Progress Alert';
          fcmRequest.notification.body = `Heads up! 🚨 You’re nearing your budget limit for ${budget.title}. You’ve spent ${budget.progressValue.toFixed(2)} out of ${budget.amount.toFixed(2)}. Keep an eye on your spending!`;
        }

        if (budget.limitExceeded) {
          //send notification about limit exceeded
          fcmRequest.notification.title = 'Budget Limit Exceeded';
          fcmRequest.notification.body = `Overspending Alert! 🛑 You’ve exceeded your budget for ${budget.title} by ${(budget.progressValue - budget.amount).toFixed(2)}. Consider reviewing your expenses.`;
        }

        const user = await this.userRepository.getByIdAsync(budget.createdBy);
        if (user && user.fcmToken?.length > 0) {
          fcmRequest.token = user.fcmToken;
          this.logger.debug('sending fcm notification', fcmRequest);
          dispatch(this.notificationActor.sendFcmNotication, fcmRequest);
        }
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

        budget.progressValue =
          parseFloat(budget.progressValue.toString()) +
          parseFloat(msg.amount.toString());
        budget.limitExceeded = budget.progressValue > budget.amount;
        budget.updatedAt = new Date();
        if (!budget.createdAt) {
          budget.createdAt = new Date();
        }
        const res = await this.budgetRepository.updateAsync(budget);

        //handle processing notification
        const progressPercentage = (budget.progressValue / budget.amount) * 100;
        const notificationPercentage =
          parseFloat(budget.receiveAlertPercentage.toString()) * 100;

        //notification params;
        const fcmRequest: FcmNotificationRequest = {
          notification: {},
          data: {},
          token: '',
        };
        if (
          progressPercentage >= notificationPercentage &&
          !budget.limitExceeded
        ) {
          //send notification about progress
          fcmRequest.notification.title = 'Budget Progress Alert';
          fcmRequest.notification.body = `Heads up! 🚨 You’re nearing your budget limit for ${budget.title}. You’ve spent ${budget.progressValue.toFixed(2)} out of ${budget.amount.toFixed(2)}. Keep an eye on your spending!`;
        }

        if (budget.limitExceeded) {
          //send notification about limit exceeded
          fcmRequest.notification.title = 'Budget Limit Exceeded';
          fcmRequest.notification.body = `Overspending Alert! 🛑 You’ve exceeded your budget for ${budget.title} by ${(budget.progressValue - budget.amount).toFixed(2)}. Consider reviewing your expenses.`;
        }

        const user = await this.userRepository.getByIdAsync(budget.createdBy);
        if (user && user.fcmToken?.length > 0) {
          fcmRequest.token = user.fcmToken;
          this.logger.debug('sending fcm notification', fcmRequest);
          dispatch(this.notificationActor.sendFcmNotication, fcmRequest);
        }

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
}
