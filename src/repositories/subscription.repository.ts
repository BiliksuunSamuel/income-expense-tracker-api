import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';

@Injectable()
export class SubscriptionRepository {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
  ) {}

  //Get user active subscription with invoice
  async getUserActiveSubscriptionWithInvoiceAsync(
    userId: string,
  ): Promise<{ subscription: Subscription; invoice: Invoice } | null> {
    const subscription = await this.subscriptionModel
      .findOne({ userId, isActive: true })
      .lean();

    if (!subscription) {
      return null;
    }

    const invoice = await this.invoiceModel
      .findOne({ subscriptionId: subscription.id })
      .lean();

    return { subscription, invoice };
  }
}
