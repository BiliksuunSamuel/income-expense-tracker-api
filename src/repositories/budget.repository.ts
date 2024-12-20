import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PagedResults } from 'src/common/paged.results.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { BudgetFilter } from 'src/dtos/budget/budget.filter.dto';
import { BudgetForDropdownDto } from 'src/dtos/budget/budget.for.dropdown.dto';
import { BudgetRequest } from 'src/dtos/budget/budget.request.dto';
import { Budget } from 'src/schemas/budget.schema.dto';
import { generateId } from 'src/utils';

@Injectable()
export class BudgetRepository {
  constructor(
    @InjectModel(Budget.name) private readonly budgetRepository: Model<Budget>,
  ) {}

  //delete budget
  async deleteAsync(id: string): Promise<Budget> {
    const res = await this.budgetRepository.findOneAndDelete({ id });
    return res;
  }

  //update budget
  async updateAsync(doc: Budget): Promise<Budget> {
    const { _id, id, ...others }: any = doc;
    const res = await this.budgetRepository
      .findOneAndUpdate({ id }, { ...others }, { new: true })
      .lean();
    return res;
  }

  //get by id
  async getById(id: string): Promise<Budget> {
    return this.budgetRepository.findOne({ id }).lean();
  }

  //update budget
  async update(
    id: string,
    request: BudgetRequest,
    user: UserJwtDetails,
  ): Promise<Budget> {
    const doc = await this.getById(id);
    if (!doc) {
      return null;
    }

    const { _id, ...others }: any = doc;
    const res = await this.budgetRepository
      .findOneAndUpdate(
        { id },
        {
          ...others,
          ...request,
          limitExceeded:
            parseFloat(request.amount.toString()) <
            parseFloat(doc.progressValue.toString()),
          updatedAt: new Date(),
        },
        { new: true },
      )
      .lean();
    return res;
  }

  //create budget
  async create(request: BudgetRequest, user: UserJwtDetails): Promise<Budget> {
    const doc = await this.budgetRepository.create({
      ...request,
      createdBy: user.id,
      id: generateId(),
    });

    return await this.getById(doc.id);
  }

  //filter budget
  async filterAsync(
    filter: BudgetFilter,
    user: UserJwtDetails,
  ): Promise<PagedResults<Budget>> {
    const query = {
      createdBy: user.id,
    };
    if (filter.status && filter.status.length > 0) {
      query['status'] = filter.status;
    }
    if (filter.query) {
      query['$or'] = [
        { title: { $regex: filter.query, $options: 'i' } },
        { description: { $regex: filter.query, $options: 'i' } },
        { category: { $regex: filter.query, $options: 'i' } },
      ];
    }

    const totalCount = await this.budgetRepository.countDocuments(query);
    const { page, pageSize } = filter;
    const data = await this.budgetRepository
      .find(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .lean();

    const totalPages = Math.ceil(totalCount / pageSize);

    const response: PagedResults<Budget> = {
      results: data,
      page,
      pageSize,
      totalCount,
      totalPages,
    };
    return response;
  }

  //get budgets for dropdown
  async getBudgetsForDropdown(
    user: UserJwtDetails,
  ): Promise<BudgetForDropdownDto[]> {
    const data = await this.budgetRepository
      .find({ createdBy: user.id })
      .lean();
    return data.map((x) => ({
      id: x.id,
      title: x.title,
      description: x.description,
    }));
  }
}
