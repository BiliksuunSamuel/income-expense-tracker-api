import { Module } from '@nestjs/common';
import { BudgetCategoryService } from './budget-category.service';
import { BudgetCategoryController } from './budget-category.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BudgetCategory,
  BudgetCategorySchema,
} from 'src/schemas/budget.category.schema.dto';
import { BudgetCategoryRepository } from 'src/repositories/budget.category.repository';

@Module({
  providers: [BudgetCategoryService, BudgetCategoryRepository],
  controllers: [BudgetCategoryController],
  imports: [
    MongooseModule.forFeature([
      {
        name: BudgetCategory.name,
        schema: BudgetCategorySchema,
      },
    ]),
  ],
})
export class BudgetCategoryModule {}
