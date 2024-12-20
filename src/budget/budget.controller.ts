import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth..guard';
import { BudgetService } from './budget.service';
import { AuthUser } from 'src/extensions/auth.extensions';
import { BudgetRequest } from 'src/dtos/budget/budget.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { Response } from 'express';
import { BudgetFilter } from 'src/dtos/budget/budget.filter.dto';
import { Budget } from 'src/schemas/budget.schema.dto';

@Controller('api/budgets')
@ApiTags('Budgets')
@UseGuards(JwtAuthGuard)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}
  //delete budget
  @Delete(':id')
  @ApiParam({ name: 'id', required: true })
  async deleteBudget(@Param('id') id: string, @Res() response: Response) {
    const res = await this.budgetService.deleteAsync(id);
    response.status(res.code).send(res);
  }
  //get budgets for dropdown
  @Get('dropdown')
  async getBudgetsForDropdown(
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.budgetService.getBudgetsForDropdown(user);
    response.status(res.code).send(res);
  }

  //filter budget
  @Get()
  @ApiResponse({ type: Budget })
  async filterBudget(
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
    @Query() query: BudgetFilter,
  ) {
    const res = await this.budgetService.filterAsync(query, user);
    response.status(res.code).send(res);
  }

  //update budget
  @Patch(':id')
  @ApiParam({ name: 'id', required: true })
  async updateBudget(
    @Param('id') id: string,
    @Body() request: BudgetRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.budgetService.updateAsync(id, request, user);
    response.status(res.code).send(res);
  }

  //create budget
  @Post()
  async createBudget(
    @Body() request: BudgetRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.budgetService.createAsync(request, user);
    response.status(res.code).send(res);
  }

  //get budget by id
  @Get(':id')
  @ApiParam({ name: 'id', required: true })
  async getBudgetById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.budgetService.getByIdAsync(id);
    response.status(res.code).send(res);
  }
}
