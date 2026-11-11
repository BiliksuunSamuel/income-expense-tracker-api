import { PaymentStatus } from 'src/enums';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import {
  generateId,
  generateInvoiceNumber,
  getInvoiceAmount,
  getInvoiceStartDateAndEndDate,
} from '.';

/// The invoice for [subscription] on [plan]: paid already when the plan is
/// free, otherwise waiting for Paystack.
export function newSubscriptionInvoice(
  subscription: Subscription,
  plan: BillingPlan,
  now = new Date(),
): Partial<Invoice> {
  const cycle = getInvoiceStartDateAndEndDate(subscription);
  const free = plan.price <= 0;
  return {
    id: generateId(),
    createdAt: now,
    userId: subscription.userId,
    subscriptionId: subscription.id,
    amount: roundCedis(getInvoiceAmount(plan, subscription.billingFrequency)),
    status: free ? PaymentStatus.Completed : PaymentStatus.Pending,
    dueDate: now,
    description: `${plan.title} plan, ${subscription.billingFrequency?.toLowerCase() ?? 'monthly'}`,
    datePaid: free ? now : null,
    paymentReference: null,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    createdBy: subscription.createdBy,
    invoiceNumber: generateInvoiceNumber(),
  };
}

/// The period a payment made at [paidAt] covers.
export function paidPeriod(
  billingFrequency: Subscription['billingFrequency'],
  paidAt: Date,
): { startDate: Date; endDate: Date } {
  return getInvoiceStartDateAndEndDate({
    startDate: paidAt,
    billingFrequency,
  } as Subscription);
}

/// To the pesewa: a yearly discount can leave more decimals.
export const roundCedis = (n: number) => Math.round(n * 100) / 100;
