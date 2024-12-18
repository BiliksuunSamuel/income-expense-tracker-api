import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Transaction,
  TransactionSchema,
} from 'src/schemas/transaction.schema.dto';
import { TransactionRepository } from 'src/repositories/transaction.repository';
import { ImageService } from 'src/providers/image.service';
import { Budget, BudgetSchema } from 'src/schemas/budget.schema.dto';
import { BudgetActor } from 'src/actors/budget.actor';
import { BudgetRepository } from 'src/repositories/budget.repository';

@Module({
  providers: [
    TransactionService,
    TransactionRepository,
    BudgetRepository,
    ImageService,
    BudgetActor,
  ],
  controllers: [TransactionController],
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Budget.name, schema: BudgetSchema },
    ]),
  ],
})
export class TransactionModule {}
