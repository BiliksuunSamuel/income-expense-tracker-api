import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RecurringTransactionStatus } from 'src/enums';
import { RecurringTransaction } from 'src/schemas/recurring.transaction.schema';

@Injectable()
export class RecurringTransactionRepository {
  constructor(
    @InjectModel(RecurringTransaction.name)
    private readonly model: Model<RecurringTransaction>,
  ) {}

  async create(recurring: RecurringTransaction): Promise<RecurringTransaction> {
    const created = await this.model.create(recurring);
    return created.toObject();
  }

  async getByUser(userId: string): Promise<RecurringTransaction[]> {
    return this.model.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async getById(id: string): Promise<RecurringTransaction> {
    return this.model.findOne({ id }).lean();
  }

  /// Active recurrings whose next run is due and which haven't passed their end.
  async getDue(now: Date): Promise<RecurringTransaction[]> {
    return this.model
      .find({
        status: RecurringTransactionStatus.Active,
        nextRunAt: { $lte: now },
        $or: [{ repeatUntil: null }, { repeatUntil: { $gte: now } }],
      })
      .lean();
  }

  /// Active recurrings that are past their end date and should be closed.
  async getExpired(now: Date): Promise<RecurringTransaction[]> {
    return this.model
      .find({
        status: RecurringTransactionStatus.Active,
        repeatUntil: { $ne: null, $lt: now },
      })
      .lean();
  }

  async update(
    id: string,
    patch: Partial<RecurringTransaction>,
  ): Promise<RecurringTransaction> {
    return this.model.findOneAndUpdate({ id }, patch, { new: true }).lean();
  }

  /** Moves [id] past the occurrence at [dueAt] if that is still the next
   * one; returns null when someone else (the scheduler, an earlier try) got
   * there first. */
  async claimOccurrence(
    id: string,
    dueAt: Date,
    patch: Partial<RecurringTransaction>,
  ): Promise<RecurringTransaction | null> {
    return this.model
      .findOneAndUpdate(
        { id, nextRunAt: dueAt, status: RecurringTransactionStatus.Active },
        patch,
        { new: true },
      )
      .lean();
  }
}
