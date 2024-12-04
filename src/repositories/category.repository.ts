import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CategoryInput } from 'src/dtos/category/category.input.dto';
import { CategoryType } from 'src/enums';
import { Category } from 'src/schemas/category.schema';
import { generateId } from 'src/utils';

@Injectable()
export class CategoryRepository {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryRepository: Model<Category>,
  ) {}

  //get category for user
  async getCategories(creatorId: string): Promise<Category[]> {
    const userCategories = await this.categoryRepository
      .find({
        $or: [{ creatorId }, { type: CategoryType.General }],
      })
      .lean();
    return userCategories;
  }

  //get category by id
  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryRepository.findById(id).lean();
    return category;
  }

  //delete category
  async deleteCategory(id: string): Promise<Category> {
    const category = await this.categoryRepository.findByIdAndDelete(id).lean();
    return category;
  }

  //create category
  async createCategory(category: CategoryInput): Promise<Category> {
    const doc = await this.categoryRepository.create({
      id: generateId(),
      title: category.title,
      creatorId: category.creatorId,
      type: category.creatorId ? CategoryType.Personal : CategoryType.General,
    });
    const newCategory = doc.toObject();
    return newCategory;
  }
}
