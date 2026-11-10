import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transfer } from 'src/schemas/transfer.schema';

@Injectable()
export class TransferRepository {
  constructor(
    @InjectModel(Transfer.name) private readonly transfers: Model<Transfer>,
  ) {}

  /** Newest first; only those touching [accountId] when given. */
  async list(
    userId: string,
    accountId?: string,
    since?: Date,
  ): Promise<Transfer[]> {
    const query: Record<string, unknown> = { userId };
    if (accountId) {
      query.$or = [{ fromAccountId: accountId }, { toAccountId: accountId }];
    }
    if (since) query.createdAt = { $gte: since };
    return this.transfers.find(query).sort({ createdAt: -1 }).lean();
  }

  async ownerOf(id: string): Promise<string | null> {
    const doc = await this.transfers.findOne({ id }, { userId: 1 }).lean();
    return doc?.userId ?? null;
  }

  async create(transfer: Transfer): Promise<Transfer> {
    await this.transfers.create(transfer);
    return transfer;
  }

  async delete(id: string, userId: string): Promise<Transfer | null> {
    return this.transfers.findOneAndDelete({ id, userId }).lean();
  }
}
