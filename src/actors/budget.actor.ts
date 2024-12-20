import { Injectable, Logger } from '@nestjs/common';
import { BaseActor } from './base.actor';
import { BudgetRepository } from 'src/repositories/budget.repository';
import { spawnStateless } from 'nact';
import { Transaction } from 'src/schemas/transaction.schema.dto';

@Injectable()
export class BudgetActor extends BaseActor {
  private readonly logger = new Logger(BudgetActor.name);
  constructor(private readonly budgetRepository: BudgetRepository) {
    super();
  }

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
