import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { CategoryInput } from 'src/dtos/category/category.input.dto';
import { CategoryResponse } from 'src/dtos/category/category.response.dto';
import { CategoryRepository } from 'src/repositories/category.repository';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  constructor(private readonly categoryRepository: CategoryRepository) {}

  //create category
  async createCategory(
    input: CategoryInput,
  ): Promise<ApiResponseDto<CategoryResponse>> {
    try {
      const res = await this.categoryRepository.createCategory(input);
      if (!res) {
        return {
          code: HttpStatus.FAILED_DEPENDENCY,
          message: 'Category not created',
          data: null,
        };
      }
      return {
        code: HttpStatus.CREATED,
        message: 'Category created successfully',
        data: {
          id: res.id,
          title: res.title,
        },
      };
    } catch (error) {
      this.logger.error(
        'an error occurred while creating category',
        error,
        input,
      );
      return {
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Sorry, something went wrong',
        data: null,
      };
    }
  }

  //get category for user
  async getCategories(
    creatorId: string,
  ): Promise<ApiResponseDto<CategoryResponse[]>> {
    try {
      const categories = await this.categoryRepository.getCategories(creatorId);
      const response: CategoryResponse[] = categories.map((category) => {
        return {
          id: category.id,
          title: category.title,
        };
      });
      return {
        code: HttpStatus.OK,
        message: 'Categories fetched successfully',
        data: response,
      };
    } catch (error) {
      this.logger.error('Error in getCategories', error, creatorId);
      return {
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Sorry,something went wrong',
        data: null,
      };
    }
  }
}
