import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import {
  CategoryOrder,
  CategoryRequest,
  CategoryResponse,
  CategoryUpdate,
} from 'src/dtos/category/category.request.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { CategoryService } from 'src/services/category.service';

@Controller('api/categories')
@ApiTags('Categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiResponse({ type: [CategoryResponse] })
  async getCategories(
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.categoryService.getCategories(user);
    response.status(res.code).json(res);
  }

  @Post()
  @ApiResponse({ type: CategoryResponse })
  async createCategory(
    @Body() request: CategoryRequest,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.categoryService.createCategory(request, user);
    response.status(res.code).json(res);
  }

  @Put('order')
  @ApiResponse({ type: [CategoryResponse] })
  async reorder(
    @Body() order: CategoryOrder,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.categoryService.reorder(order, user);
    response.status(res.code).json(res);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  async updateCategory(
    @Param('id') id: string,
    @Body() changes: CategoryUpdate,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.categoryService.updateCategory(id, changes, user);
    response.status(res.code).json(res);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  async deleteCategory(
    @Param('id') id: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.categoryService.deleteCategory(id, user);
    response.status(res.code).json(res);
  }
}
