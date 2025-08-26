import { Injectable, Logger } from '@nestjs/common';
import { BaseActor } from './base.actor';
import { InjectModel } from '@nestjs/mongoose';
import { Invoice } from 'src/schemas/invoice.schema';
import { Model } from 'mongoose';
import { spawnStateless } from 'nact';
import {
  generateId,
  generateInvoiceNumber,
  getInvoiceAmount,
  getInvoiceStartDateAndEndDate,
} from 'src/utils';
import { Subscription } from 'src/schemas/subscription.schema';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import {
  BillingFrequency,
  BillingPlanType,
  PaymentStatus,
  SubscriptionStatus,
} from 'src/enums';
import { User } from 'src/schemas/user.schema';

@Injectable()
export class InvoiceActor extends BaseActor {
  private readonly logger = new Logger(InvoiceActor.name);
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(BillingPlan.name)
    private readonly billingPlanRepository: Model<BillingPlan>,
  ) {
    super();
  }

  //Setup subscription for new user
  setupSubscriptionForNewUser = spawnStateless(
    this.system,
    async (msg: { user: User }, ctx) => {
      try {
        this.logger.log('Setting up subscription for new user', msg);

        const user = msg.user;
        const billingPlan = await this.billingPlanRepository
          .findOne({ title: BillingPlanType.Regular })
          .lean();

        if (!billingPlan) return;

        //check if user already has a subscription
        const existingSubscription = await this.subscriptionModel
          .findOne({ userId: user.id, planTitle: BillingPlanType.Regular })
          .lean();
        if (existingSubscription) {
          this.logger.log(
            'User already has a subscription, skipping setup',
            user.id,
          );
          return;
        }

        //Create subscription for the user
        const doc = await this.subscriptionModel.create({
          userId: user.id,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1),
          ),
          planTitle: billingPlan.title,
          id: generateId(),
          createdAt: new Date(),
          createdBy: user.email,
          status:
            billingPlan.price == 0
              ? SubscriptionStatus.Active
              : SubscriptionStatus.Pending,
          maxNumberOfTransactions: billingPlan.maxNumberOfTransactions || 0,
          billingPlanId: billingPlan.id,
          billingFrequency: BillingFrequency.Monthly,
        });

        const subscription = doc.toObject();
        this.logger.log(
          'Subscription created successfully for new user',
          subscription,
        );

        // Create invoice for the subscription
        const billingCycle = getInvoiceStartDateAndEndDate(subscription);
        const status =
          billingPlan.price > 0
            ? PaymentStatus.Pending
            : PaymentStatus.Completed;
        const invoiceDoc = await this.invoiceModel.create({
          id: generateId(),
          createdAt: new Date(),
          userId: subscription.userId,
          subscriptionId: subscription.id,
          amount: getInvoiceAmount(billingPlan, subscription.billingFrequency),
          status,
          dueDate: new Date(),
          description: `Invoice for ${billingPlan.title} subscription from ${billingCycle.startDate.toLocaleDateString()} to ${billingCycle.endDate.toLocaleDateString()}`,
          datePaid: null,
          paymentReference: null,
          startDate: billingCycle.startDate,
          endDate: billingCycle.endDate,
          createdBy: subscription.createdBy,
          invoiceNumber: generateInvoiceNumber(),
        });
      } catch (error) {
        this.logger.error(
          'Error setting up subscription for new user',
          msg,
          error,
        );
      }
    },
  );

  //Create invoice for subscription
  createInvoiceForSubscription = spawnStateless(
    this.system,
    async (
      msg: { subscription: Subscription; billingPlan: BillingPlan },
      ctx,
    ) => {
      try {
        const { subscription, billingPlan } = msg;
        this.logger.log('Creating invoice for subscription', subscription);
        const billingCycle = getInvoiceStartDateAndEndDate(subscription);
        const status =
          billingPlan.price > 0
            ? PaymentStatus.Pending
            : PaymentStatus.Completed;
        const doc = await this.invoiceModel.create({
          id: generateId(),
          createdAt: new Date(),
          userId: subscription.userId,
          subscriptionId: subscription.id,
          amount: getInvoiceAmount(billingPlan, subscription.billingFrequency),
          status,
          dueDate: new Date(),
          description: `Invoice for ${billingPlan.title} subscription from ${billingCycle.startDate.toLocaleDateString()} to ${billingCycle.endDate.toLocaleDateString()}`,
          datePaid: null,
          paymentReference: null,
          startDate: billingCycle.startDate,
          endDate: billingCycle.endDate,
          createdBy: subscription.createdBy,
          invoiceNumber: generateInvoiceNumber(),
        });

        var invoice = doc.toObject();
        this.logger.log('Invoice created successfully', invoice);
      } catch (error) {
        this.logger.error(
          'Error creating invoice for subscription',
          msg,
          error,
        );
      }
    },
  );
}
