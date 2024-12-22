import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { BudgetCategoryRequestDto } from 'src/dtos/budget-category/budget.category.request.dto';
import { BudgetCategory } from 'src/schemas/budget.category.schema.dto';
import { generateId } from 'src/utils';

@Injectable()
export class BudgetCategoryRepository {
  constructor(
    @InjectModel(BudgetCategory.name)
    private readonly budgetCategoryRepository: Model<BudgetCategory>,
  ) {}

  //validate cateogry for user
  async validateCategoryForUser(
    title: string,
    user: UserJwtDetails,
  ): Promise<boolean> {
    const count = await this.budgetCategoryRepository.countDocuments({
      $or: [
        { title, createdBy: user.id },
        { title, createdBy: 'General' },
      ],
    });
    return count < 1;
  }

  //get by id
  async getById(id: string): Promise<BudgetCategory> {
    return this.budgetCategoryRepository.findOne({ id }).lean();
  }

  //create budget category
  async create(
    request: BudgetCategoryRequestDto,
    userId: string,
  ): Promise<BudgetCategory> {
    const doc = await this.budgetCategoryRepository.create({
      title: request.title,
      description: request.description,
      createdBy: userId,
      id: generateId(),
    });
    return await this.getById(doc.id);
  }

  //get all for user
  async getAllForUser(user: UserJwtDetails): Promise<BudgetCategory[]> {
    return this.budgetCategoryRepository
      .find({ $or: [{ createdBy: user.id }, { createdBy: 'General' }] })
      .lean();
  }
}
