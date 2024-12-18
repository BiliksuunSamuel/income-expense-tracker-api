import { Test, TestingModule } from '@nestjs/testing';
import { BudgetCategoryService } from './budget-category.service';

describe('BudgetCategoryService', () => {
  let service: BudgetCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetCategoryService],
    }).compile();

    service = module.get<BudgetCategoryService>(BudgetCategoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
