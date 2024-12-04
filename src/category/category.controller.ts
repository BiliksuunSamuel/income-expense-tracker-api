import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CategoryInput } from 'src/dtos/category/category.input.dto';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth..guard';
import { AuthUser } from 'src/extensions/auth.extensions';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';

@Controller('api/categories')
@ApiTags('Categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  //create category
  @Post()
  async createCategory(
    @Body() request: CategoryInput,
    @Res() response: Response,
  ) {
    const res = await this.categoryService.createCategory(request);
    return response.status(res.code).json(res);
  }

  //get categories
  @Get()
  @UseGuards(JwtAuthGuard)
  async getCategories(
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.categoryService.getCategories(user.id);
    return response.status(res.code).json(res);
  }
}
