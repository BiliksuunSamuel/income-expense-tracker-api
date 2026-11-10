import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CategoryKind, CategoryType } from 'src/enums';
import { Category } from 'src/schemas/category.schema';
import { RecurringTransaction } from 'src/schemas/recurring.transaction.schema';
import { Transaction } from 'src/schemas/transaction.schema';

const DUPLICATE_KEY = 11000;

@Injectable()
export class CategoryRepository implements OnModuleInit {
  private readonly logger = new Logger(CategoryRepository.name);

  constructor(
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Transaction.name)
    private readonly transactions: Model<Transaction>,
    @InjectModel(RecurringTransaction.name)
    private readonly recurring: Model<RecurringTransaction>,
  ) {}

  async onModuleInit() {
    try {
      await this.categories.collection.createIndex(
        { creatorId: 1, kind: 1, titleKey: 1 },
        {
          unique: true,
          partialFilterExpression: { titleKey: { $type: 'string' } },
        },
      );
    } catch (error) {
      this.logger.error('could not create the category title index', error);
    }
  }

  /** Every category [userId] owns, including old ones without a kind. */
  async ownedBy(userId: string): Promise<Category[]> {
    return this.categories
      .find({ creatorId: userId, type: { $ne: CategoryType.General } })
      .sort({ position: 1, createdAt: 1 })
      .lean();
  }

  async byId(id: string, userId: string): Promise<Category | null> {
    return this.categories.findOne({ id, creatorId: userId }).lean();
  }

  async ownerOf(id: string): Promise<string | null> {
    const doc = await this.categories.findOne({ id }, { creatorId: 1 }).lean();
    return doc?.creatorId ?? null;
  }

  async byTitle(
    userId: string,
    kind: CategoryKind,
    key: string,
  ): Promise<Category | null> {
    return this.categories
      .findOne({ creatorId: userId, kind, titleKey: key })
      .lean();
  }

  /** Inserts [docs], skipping any whose title the user already has. */
  async insertMissing(docs: Category[]): Promise<void> {
    if (docs.length === 0) return;
    try {
      await this.categories.insertMany(docs, { ordered: false });
    } catch (error) {
      const dupOnly = (error?.writeErrors ?? [error]).every(
        (e: any) => (e?.code ?? e?.err?.code) === DUPLICATE_KEY,
      );
      if (!dupOnly) throw error;
    }
  }

  async create(doc: Category): Promise<Category> {
    await this.categories.create(doc);
    return doc;
  }

  async update(
    id: string,
    userId: string,
    changes: Partial<Category>,
  ): Promise<Category | null> {
    return this.categories
      .findOneAndUpdate({ id, creatorId: userId }, changes, { new: true })
      .lean();
  }

  async delete(id: string, userId: string): Promise<Category | null> {
    return this.categories.findOneAndDelete({ id, creatorId: userId }).lean();
  }

  /** Sets each of [ids]' position to its index; ids the user doesn't own
   * are ignored. */
  async reorder(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.categories.bulkWrite(
      ids.map((id, position) => ({
        updateOne: {
          filter: { id, creatorId: userId },
          update: { $set: { position } },
        },
      })),
      { ordered: false },
    );
  }

  async hasChildren(id: string, userId: string): Promise<boolean> {
    return (
      (await this.categories.exists({ creatorId: userId, parentId: id })) !=
      null
    );
  }

  /** Whether any of the user's transactions or repeats use [title]. */
  async isUsed(
    userId: string,
    kind: CategoryKind,
    title: string,
  ): Promise<boolean> {
    const query = { userId, type: kind, category: title };
    const [t, r] = await Promise.all([
      this.transactions.exists(query),
      this.recurring.exists(query),
    ]);
    return t != null || r != null;
  }

  /** Carries a rename into the user's transactions and repeats. */
  async renameInEntries(
    userId: string,
    kind: CategoryKind,
    from: string,
    to: string,
  ): Promise<number> {
    const query = { userId, type: kind, category: from };
    const [t] = await Promise.all([
      this.transactions.updateMany(query, { category: to }),
      this.recurring.updateMany(query, { category: to }),
    ]);
    return t.modifiedCount ?? 0;
  }

  /** The (title, type) pairs the user's transactions use. */
  async usedTitles(
    userId: string,
  ): Promise<{ title: string; kind: CategoryKind }[]> {
    const rows = await this.transactions.aggregate<{
      _id: { title: string; kind: CategoryKind };
    }>([
      { $match: { userId, category: { $type: 'string', $ne: '' } } },
      { $group: { _id: { title: '$category', kind: '$type' } } },
    ]);
    return rows.map((r) => r._id);
  }
}
