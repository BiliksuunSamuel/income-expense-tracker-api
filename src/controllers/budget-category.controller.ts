import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BudgetCategoryService } from '../services/budget-category.service';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AuthUser } from 'src/extensions/auth.extensions';
import { BudgetCategoryRequestDto } from 'src/dtos/budget-category/budget.category.request.dto';

@Controller('api/budget-categories')
@ApiTags('Budget Categories')
@UseGuards(JwtAuthGuard)
export class BudgetCategoryController {
  constructor(private readonly budgetCategoryService: BudgetCategoryService) {}

  //create budget category
  @Post()
  async createBudgetCategory(
    @Body() request: BudgetCategoryRequestDto,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.budgetCategoryService.createForUser(request, user);
    response.status(res.code).send(res);
  }

  //get all budget categories
  @Get()
  async getAllBudgetCategories(
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.budgetCategoryService.getAllForUser(user);
    response.status(res.code).send(res);
  }
}
