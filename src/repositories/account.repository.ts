import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account } from 'src/schemas/account.schema';
import { Transaction } from 'src/schemas/transaction.schema';
import { Transfer } from 'src/schemas/transfer.schema';

/** Totals per account, as stored: income and expense from transactions,
 * money in and out from transfers. */
export interface AccountTotals {
  income: Map<string, number>;
  expense: Map<string, number>;
  transferredOut: Map<string, number>;
  transferredIn: Map<string, number>;
}

@Injectable()
export class AccountRepository {
  constructor(
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    @InjectModel(Transaction.name)
    private readonly transactions: Model<Transaction>,
    @InjectModel(Transfer.name) private readonly transfers: Model<Transfer>,
  ) {}

  async list(userId: string): Promise<Account[]> {
    return this.accounts.find({ userId }).sort({ createdAt: 1 }).lean();
  }

  async byId(id: string, userId: string): Promise<Account | null> {
    return this.accounts.findOne({ id, userId }).lean();
  }

  /** Who owns [id], if it exists at all (any user). */
  async ownerOf(id: string): Promise<string | null> {
    const doc = await this.accounts.findOne({ id }, { userId: 1 }).lean();
    return doc?.userId ?? null;
  }

  async create(account: Account): Promise<Account> {
    await this.accounts.create(account);
    return account;
  }

  async update(
    id: string,
    userId: string,
    changes: Partial<Account>,
  ): Promise<Account | null> {
    return this.accounts
      .findOneAndUpdate({ id, userId }, changes, { new: true })
      .lean();
  }

  async delete(id: string, userId: string): Promise<Account | null> {
    return this.accounts.findOneAndDelete({ id, userId }).lean();
  }

  /** Makes [id] the only default account of [userId]. */
  async setDefault(id: string, userId: string): Promise<void> {
    await this.accounts.updateMany(
      { userId, id: { $ne: id } },
      { isDefault: false },
    );
    await this.accounts.updateOne({ id, userId }, { isDefault: true });
  }

  /** Points the user's transactions that name no real account at [id]
   * (entries from before accounts: "Default", empty or unknown). */
  async adoptOrphanTransactions(
    userId: string,
    id: string,
    known: string[],
  ): Promise<number> {
    const res = await this.transactions.updateMany(
      { userId, account: { $nin: known } },
      { account: id },
    );
    return res.modifiedCount ?? 0;
  }

  async isUsed(id: string, userId: string): Promise<boolean> {
    const [tx, tr] = await Promise.all([
      this.transactions.exists({ userId, account: id }),
      this.transfers.exists({
        userId,
        $or: [{ fromAccountId: id }, { toAccountId: id }],
      }),
    ]);
    return Boolean(tx || tr);
  }

  /** All-time totals, or only those before [before] when given. */
  async totals(userId: string, before?: Date): Promise<AccountTotals> {
    const match = before
      ? { userId, createdAt: { $lt: before } }
      : { userId };
    const [byType, out, inn] = await Promise.all([
      this.transactions.aggregate([
        { $match: match },
        {
          $group: {
            _id: { account: '$account', type: '$type' },
            total: { $sum: '$amount' },
          },
        },
      ]),
      this.transfers.aggregate([
        { $match: match },
        { $group: { _id: '$fromAccountId', total: { $sum: '$amount' } } },
      ]),
      this.transfers.aggregate([
        { $match: match },
        { $group: { _id: '$toAccountId', total: { $sum: '$amount' } } },
      ]),
    ]);
    const totals: AccountTotals = {
      income: new Map(),
      expense: new Map(),
      transferredOut: new Map(out.map((r) => [r._id, r.total])),
      transferredIn: new Map(inn.map((r) => [r._id, r.total])),
    };
    for (const r of byType) {
      const map = r._id.type === 'Income' ? totals.income : totals.expense;
      map.set(r._id.account, r.total);
    }
    return totals;
  }
}
