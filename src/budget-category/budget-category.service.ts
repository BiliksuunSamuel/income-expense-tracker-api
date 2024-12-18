import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { BudgetCategoryRequestDto } from 'src/dtos/budget-category/budget.category.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { BudgetCategoryRepository } from 'src/repositories/budget.category.repository';
import { BudgetCategory } from 'src/schemas/budget.category.schema.dto';

@Injectable()
export class BudgetCategoryService {
  private readonly logger = new Logger(BudgetCategoryService.name);
  constructor(
    private readonly budgetCategoryRepository: BudgetCategoryRepository,
  ) {}

  //create for user
  async createForUser(
    request: BudgetCategoryRequestDto,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<BudgetCategory>> {
    try {
      this.logger.debug(
        'request to create budget cateogry for user\n',
        request,
        user,
      );
      const isValid =
        await this.budgetCategoryRepository.validateCategoryForUser(
          request.title,
          user,
        );
      if (!isValid) {
        return CommonResponses.ConflictResponse<BudgetCategory>(
          'Category already exists',
        );
      }
      const category = await this.budgetCategoryRepository.create(
        request,
        user.id,
      );
      return CommonResponses.OkResponse(category);
    } catch (error) {
      this.logger.error(
        'an error occurred while creating budget category for user\n',
        user,
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<BudgetCategory>(
        'An error occurred while creating budget category for user',
      );
    }
  }

  //get all for user
  async getAllForUser(
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<BudgetCategory[]>> {
    try {
      const categories =
        await this.budgetCategoryRepository.getAllForUser(user);
      return CommonResponses.OkResponse(categories);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting all budget categories for user\n',
        user,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<BudgetCategory[]>(
        'An error occurred while getting all budget categories for user',
      );
    }
  }
}
