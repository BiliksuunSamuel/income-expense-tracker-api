import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import {
  CategoryOrder,
  CategoryRequest,
  CategoryUpdate,
} from 'src/dtos/category/category.request.dto';
import { CategoryKind, CategoryType } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { CategoryRepository } from 'src/repositories/category.repository';
import { Category } from 'src/schemas/category.schema';
import { generateId } from 'src/utils';
import {
  CategoryLook,
  STARTER_CATEGORIES,
  cleanTitle,
  guessLook,
  titleKey,
} from 'src/utils/categories';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly categoryRepository: CategoryRepository) {}

  async getCategories(
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Category[]>> {
    try {
      return CommonResponses.OkResponse(await this.ensureCategories(user));
    } catch (error) {
      this.logger.error('could not get categories', user.id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while getting categories',
      );
    }
  }

  /** Adds a category. One with the same title and kind is returned as it
   * is (and shown again if it was archived). */
  async createCategory(
    request: CategoryRequest,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Category>> {
    try {
      if (request.id) {
        const owner = await this.categoryRepository.ownerOf(request.id);
        if (owner === user.id) {
          return CommonResponses.OkResponse(
            await this.categoryRepository.byId(request.id, user.id),
            'Category already saved',
          );
        }
        if (owner) {
          return CommonResponses.ConflictResponse(
            'A category with this id already exists',
          );
        }
      }
      await this.ensureCategories(user);
      const kind = request.kind ?? CategoryKind.Expense;
      const title = cleanTitle(request.title);
      const existing = await this.categoryRepository.byTitle(
        user.id,
        kind,
        titleKey(title),
      );
      if (existing) {
        const shown = existing.archived
          ? await this.categoryRepository.update(existing.id, user.id, {
              archived: false,
            })
          : existing;
        return CommonResponses.OkResponse(shown, 'Category already exists');
      }
      const parentError = await this.parentError(
        user.id,
        kind,
        request.parentId,
      );
      if (parentError) {
        return CommonResponses.BadRequestResponse(null, parentError);
      }
      const look = guessLook(title);
      const all = await this.categoryRepository.ownedBy(user.id);
      const category = this.newCategory(user, {
        position:
          all.reduce((max, c) => Math.max(max, c.position ?? 0), -1) + 1,
        id: request.id,
        title,
        kind,
        icon: request.icon ?? look.icon,
        color: request.color ?? look.color,
        parentId: request.parentId ?? null,
      });
      await this.categoryRepository.create(category);
      return CommonResponses.CreatedResponse(category, 'Category added');
    } catch (error) {
      this.logger.error('could not create category', user.id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while adding the category',
      );
    }
  }

  /** Renames (carried into past entries), restyles, moves or archives. */
  async updateCategory(
    id: string,
    changes: CategoryUpdate,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Category>> {
    try {
      const category = await this.categoryRepository.byId(id, user.id);
      if (!category) {
        return CommonResponses.NotFoundResponse('Category not found');
      }
      const update: Partial<Category> = {
        ...(changes.icon && { icon: changes.icon }),
        ...(changes.color && { color: changes.color }),
        ...(changes.archived !== undefined && { archived: changes.archived }),
      };

      if (
        changes.parentId !== undefined &&
        changes.parentId !== category.parentId
      ) {
        if (changes.parentId === id) {
          return CommonResponses.BadRequestResponse(
            null,
            'A category cannot sit under itself',
          );
        }
        if (
          changes.parentId &&
          (await this.categoryRepository.hasChildren(id, user.id))
        ) {
          return CommonResponses.BadRequestResponse(
            null,
            'This category has its own sub-categories, so it cannot move under another',
          );
        }
        const parentError = await this.parentError(
          user.id,
          category.kind,
          changes.parentId,
        );
        if (parentError) {
          return CommonResponses.BadRequestResponse(null, parentError);
        }
        update.parentId = changes.parentId;
      }

      const oldTitle = category.title;
      const newTitle = changes.title ? cleanTitle(changes.title) : null;
      const renamed = newTitle != null && newTitle !== category.title;
      if (renamed) {
        const clash = await this.categoryRepository.byTitle(
          user.id,
          category.kind,
          titleKey(newTitle),
        );
        if (clash && clash.id !== id) {
          return CommonResponses.ConflictResponse(
            `You already have a category called ${clash.title}`,
          );
        }
        update.title = newTitle;
        update.titleKey = titleKey(newTitle);
      }

      const updated = await this.categoryRepository.update(id, user.id, {
        ...update,
        updatedAt: new Date(),
        updatedBy: user.email,
      });
      if (renamed) {
        await this.categoryRepository.renameInEntries(
          user.id,
          category.kind,
          oldTitle,
          newTitle,
        );
      }
      return CommonResponses.OkResponse(updated, 'Category updated');
    } catch (error) {
      this.logger.error('could not update category', id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while updating the category',
      );
    }
  }

  /** Saves the order the user arranged their categories in. */
  async reorder(
    order: CategoryOrder,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Category[]>> {
    try {
      await this.categoryRepository.reorder(user.id, [...new Set(order.ids)]);
      return CommonResponses.OkResponse(
        await this.categoryRepository.ownedBy(user.id),
        'Order saved',
      );
    } catch (error) {
      this.logger.error('could not reorder categories', user.id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while saving the order',
      );
    }
  }

  /** Only an unused category with no sub-categories can be deleted. */
  async deleteCategory(
    id: string,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<Category>> {
    try {
      const category = await this.categoryRepository.byId(id, user.id);
      if (!category) {
        return CommonResponses.NotFoundResponse('Category not found');
      }
      if (await this.categoryRepository.hasChildren(id, user.id)) {
        return CommonResponses.ConflictResponse(
          'Move or delete its sub-categories first',
        );
      }
      if (
        await this.categoryRepository.isUsed(
          user.id,
          category.kind,
          category.title,
        )
      ) {
        return CommonResponses.ConflictResponse(
          'This category has entries. Archive it instead.',
        );
      }
      const deleted = await this.categoryRepository.delete(id, user.id);
      return CommonResponses.OkResponse(deleted, 'Category deleted');
    } catch (error) {
      this.logger.error('could not delete category', id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while deleting the category',
      );
    }
  }

  /** Makes sure a transaction's category exists for its owner. */
  async remember(
    user: UserJwtDetails,
    title: string,
    kind: CategoryKind,
  ): Promise<void> {
    const clean = title ? cleanTitle(title) : '';
    if (!clean) return;
    await this.ensureCategories(user);
    if (await this.categoryRepository.byTitle(user.id, kind, titleKey(clean))) {
      return;
    }
    const all = await this.categoryRepository.ownedBy(user.id);
    await this.categoryRepository.insertMissing([
      this.newCategory(user, {
        title: clean,
        kind,
        ...guessLook(clean),
        position:
          all.reduce((max, c) => Math.max(max, c.position ?? 0), -1) + 1,
      }),
    ]);
  }

  /** The user's categories. The first call gives them the starter set plus
   * one for every title their transactions already use, and fills in the
   * kind, icon and colour of categories saved before those existed. */
  async ensureCategories(user: UserJwtDetails): Promise<Category[]> {
    const owned = await this.categoryRepository.ownedBy(user.id);
    if (owned.length > 0 && owned.every((c) => c.kind)) return owned;

    const have = new Set(
      owned.filter((c) => c.kind).map((c) => `${c.kind}:${c.titleKey}`),
    );
    const wanted = new Map<
      string,
      { title: string; kind: CategoryKind } & CategoryLook
    >();
    const want = (title: string, kind: CategoryKind, look?: CategoryLook) => {
      const clean = cleanTitle(title);
      if (!clean) return;
      const key = `${kind}:${titleKey(clean)}`;
      if (have.has(key) || wanted.has(key)) return;
      wanted.set(key, { title: clean, kind, ...(look ?? guessLook(clean)) });
    };

    for (const s of STARTER_CATEGORIES) want(s.title, s.kind, s);
    const used = await this.categoryRepository.usedTitles(user.id);
    for (const u of used) {
      if (Object.values(CategoryKind).includes(u.kind)) want(u.title, u.kind);
    }

    for (const old of owned.filter((c) => !c.kind)) {
      const kinds = used
        .filter((u) => titleKey(u.title) === titleKey(old.title ?? ''))
        .map((u) => u.kind);
      const kind = kinds[0] ?? CategoryKind.Expense;
      const key = `${kind}:${titleKey(old.title ?? '')}`;
      if (!old.title || have.has(key)) {
        await this.categoryRepository.delete(old.id, user.id);
        continue;
      }
      const look = wanted.get(key) ?? guessLook(old.title);
      await this.categoryRepository.update(old.id, user.id, {
        title: cleanTitle(old.title),
        titleKey: titleKey(old.title),
        type: CategoryType.Personal,
        kind,
        icon: look.icon,
        color: look.color,
        parentId: null,
        archived: false,
        createdAt: old.createdAt ?? new Date(),
      });
      have.add(key);
      wanted.delete(key);
    }

    const start =
      owned.reduce((max, c) => Math.max(max, c.position ?? 0), -1) + 1;
    await this.categoryRepository.insertMissing(
      [...wanted.values()].map((w, i) =>
        this.newCategory(user, { ...w, position: start + i }),
      ),
    );
    this.logger.log(`set up categories for ${user.id}`);
    return this.categoryRepository.ownedBy(user.id);
  }

  private async parentError(
    userId: string,
    kind: CategoryKind,
    parentId?: string | null,
  ): Promise<string | null> {
    if (!parentId) return null;
    const parent = await this.categoryRepository.byId(parentId, userId);
    if (!parent) return 'That parent category was not found';
    if (parent.kind !== kind) {
      return 'A sub-category must be for the same kind of entry as its parent';
    }
    if (parent.parentId) return 'Sub-categories cannot have their own';
    return null;
  }

  private newCategory(
    user: UserJwtDetails,
    fields: Pick<Category, 'title' | 'kind' | 'icon' | 'color'> & {
      id?: string;
      parentId?: string | null;
      position?: number;
    },
  ): Category {
    return {
      id: fields.id ?? generateId(),
      title: fields.title,
      titleKey: titleKey(fields.title),
      creatorId: user.id,
      type: CategoryType.Personal,
      kind: fields.kind,
      icon: fields.icon,
      color: fields.color,
      parentId: fields.parentId ?? null,
      position: fields.position ?? 0,
      archived: false,
      createdAt: new Date(),
      createdBy: user.email,
      updatedAt: null,
      updatedBy: null,
    };
  }
}
