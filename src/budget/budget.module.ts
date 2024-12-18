import { Module } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Budget, BudgetSchema } from 'src/schemas/budget.schema.dto';
import { BudgetRepository } from 'src/repositories/budget.repository';
import { BudgetActor } from 'src/actors/budget.actor';

@Module({
  providers: [BudgetService, BudgetRepository, BudgetActor],
  controllers: [BudgetController],
  imports: [
    MongooseModule.forFeature([{ name: Budget.name, schema: BudgetSchema }]),
  ],
})
export class BudgetModule {}
