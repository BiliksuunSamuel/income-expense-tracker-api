import { Injectable, Logger } from '@nestjs/common';
import { BaseActor } from './base.actor';
import { spawnStateless } from 'nact';
import { CategoryRepository } from 'src/repositories/category.repository';

@Injectable()
export class CategoryActor extends BaseActor {
  private readonly logger = new Logger(CategoryActor.name);
  constructor(private readonly categoryRepository: CategoryRepository) {
    super();
  }

  //handle create category
  createNewCategory = spawnStateless(
    this.system,
    async (msg: { creatorId: string; title: string }, ctx) => {
      try {
        this.logger.debug(
          'received message to create new category',
          msg,
          ctx.name,
        );
        //get category by title
        const existingDoc = await this.categoryRepository.getCategoryByTitle(
          msg.title,
        );
        if (existingDoc) {
          this.logger.debug(
            'category with the same title already exists',
            msg,
            ctx.name,
            existingDoc,
          );
          return;
        }
        const doc = await this.categoryRepository.createCategory({
          title: msg.title,
          creatorId: msg.creatorId,
        });
        this.logger.debug('new category created', doc, ctx.name);
      } catch (error) {
        this.logger.error(
          'an error occurred while adding new category',
          msg,
          ctx.name,
          error,
        );
      }
    },
  );
}
