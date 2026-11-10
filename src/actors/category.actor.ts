import { Injectable, Logger } from '@nestjs/common';
import { spawnStateless } from 'nact';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { CategoryKind } from 'src/enums';
import { CategoryService } from 'src/services/category.service';
import { BaseActor } from './base.actor';

@Injectable()
export class CategoryActor extends BaseActor {
  private readonly logger = new Logger(CategoryActor.name);

  constructor(private readonly categoryService: CategoryService) {
    super();
  }

  /** Adds a transaction's category to its owner's list if it is new. */
  createNewCategory = spawnStateless(
    this.system,
    async (
      msg: {
        user: Pick<UserJwtDetails, 'id' | 'email'>;
        title: string;
        kind: CategoryKind;
      },
      ctx,
    ) => {
      try {
        await this.categoryService.remember(
          msg.user as UserJwtDetails,
          msg.title,
          msg.kind,
        );
      } catch (error) {
        this.logger.error('could not remember category', msg, ctx.name, error);
      }
    },
  );
}
