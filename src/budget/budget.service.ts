import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { BudgetFilter } from 'src/dtos/budget/budget.filter.dto';
import { BudgetForDropdownDto } from 'src/dtos/budget/budget.for.dropdown.dto';
import { BudgetRequest } from 'src/dtos/budget/budget.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { BudgetRepository } from 'src/repositories/budget.repository';
import { Budget } from 'src/schemas/budget.schema.dto';

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);
  constructor(private readonly budgetRepository: BudgetRepository) {}
  //delete budget
  async deleteAsync(id: string): Promise<ApiResponseDto<Budget>> {
    try {
      this.logger.debug('request to delete budget', id);
      const budget = await this.budgetRepository.deleteAsync(id);
      if (!budget) {
        return CommonResponses.NotFoundResponse<Budget>();
      }
      return CommonResponses.OkResponse(budget, 'Budget deleted successfully');
    } catch (error) {
      this.logger.error('an error occurred while deleting budget', id, error);
      return CommonResponses.InternalServerErrorResponse<Budget>();
    }
  }
  //update budget
  async updateAsync(
    id: string,
    request: BudgetRequest,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Budget>> {
    try {
      this.logger.debug('request to update budget', id, request, user);
      const budget = await this.budgetRepository.update(id, request, user);
      if (!budget) {
        return CommonResponses.NotFoundResponse<Budget>();
      }
      return CommonResponses.OkResponse(budget, 'Budget updated successfully');
    } catch (error) {
      this.logger.error(
        'an error occurred while updating budget',
        id,
        request,
        user,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Budget>();
    }
  }

  //create budtget
  async createAsync(
    request: BudgetRequest,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Budget>> {
    try {
      this.logger.debug('request to create budget', request, user);
      const budget = await this.budgetRepository.create(request, user);
      return CommonResponses.CreatedResponse(
        budget,
        'Budget created successfully',
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while creating budget',
        request,
        user,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Budget>();
    }
  }

  //get by id
  async getByIdAsync(id: string): Promise<ApiResponseDto<Budget>> {
    try {
      const budget = await this.budgetRepository.getById(id);
      if (!budget) {
        return CommonResponses.NotFoundResponse<Budget>();
      }
      return CommonResponses.OkResponse(budget);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting budget by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Budget>();
    }
  }

  //filter budget
  async filterAsync(
    filter: BudgetFilter,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<PagedResults<Budget>>> {
    try {
      const result = await this.budgetRepository.filterAsync(filter, user);
      return CommonResponses.OkResponse(result);
    } catch (error) {
      this.logger.error(
        'an error occurred while filtering budget',
        filter,
        user,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<Budget>
      >();
    }
  }

  //get budgets for dropdown
  async getBudgetsForDropdown(
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<BudgetForDropdownDto[]>> {
    try {
      const data = await this.budgetRepository.getBudgetsForDropdown(user);
      return CommonResponses.OkResponse(data);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting budgets for dropdown',
        user,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        BudgetForDropdownDto[]
      >();
    }
  }
}
