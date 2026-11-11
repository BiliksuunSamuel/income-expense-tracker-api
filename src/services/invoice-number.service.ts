import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter } from 'src/schemas/counter.schema';

/// Invoice numbers in order, one run per year: INV-2026-000123.
@Injectable()
export class InvoiceNumberService {
  constructor(
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
  ) {}

  async next(now = new Date()): Promise<string> {
    const year = now.getUTCFullYear();
    const counter = await this.counterModel
      .findOneAndUpdate(
        { key: `invoice-${year}` },
        { $inc: { value: 1 } },
        { new: true, upsert: true },
      )
      .lean();
    return `INV-${year}-${String(counter.value).padStart(6, '0')}`;
  }
}
