import configuration from 'src/configuration';
import { InvoiceKind, PaymentStatus } from 'src/enums';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import {
  generateId,
  getInvoiceAmount,
  getInvoiceStartDateAndEndDate,
} from '.';

const DAY_MS = 24 * 60 * 60 * 1000;

/// The invoice for choosing [plan]: paid already when the plan is free,
/// otherwise waiting for Paystack.
export function newSubscriptionInvoice(
  subscription: Subscription,
  plan: BillingPlan,
  invoiceNumber: string,
  now = new Date(),
): Partial<Invoice> {
  const cycle = getInvoiceStartDateAndEndDate(subscription);
  const free = plan.price <= 0;
  return {
    id: generateId(),
    createdAt: now,
    userId: subscription.userId,
    subscriptionId: subscription.id,
    billingPlanId: plan.id,
    kind: InvoiceKind.New,
    amount: roundCedis(getInvoiceAmount(plan, subscription.billingFrequency)),
    currency: configuration().paystackConfig.currency,
    status: free ? PaymentStatus.Completed : PaymentStatus.Pending,
    dueDate: now,
    description: `${plan.title} plan, ${subscription.billingFrequency?.toLowerCase() ?? 'monthly'}`,
    datePaid: free ? now : null,
    paymentReference: null,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    createdBy: subscription.createdBy,
    invoiceNumber,
  };
}

/// The invoice for [subscription]'s next period, which starts when the
/// current one ends; due on that day.
export function renewalInvoice(
  subscription: Subscription,
  plan: BillingPlan,
  invoiceNumber: string,
  now = new Date(),
): Partial<Invoice> {
  const next = getInvoiceStartDateAndEndDate({
    startDate: subscription.endDate,
    billingFrequency: subscription.billingFrequency,
  });
  return {
    id: generateId(),
    createdAt: now,
    userId: subscription.userId,
    subscriptionId: subscription.id,
    billingPlanId: plan.id,
    kind: InvoiceKind.Renewal,
    amount: roundCedis(getInvoiceAmount(plan, subscription.billingFrequency)),
    currency: configuration().paystackConfig.currency,
    status: PaymentStatus.Pending,
    dueDate: subscription.endDate,
    description: `${plan.title} plan renewal, ${subscription.billingFrequency?.toLowerCase() ?? 'monthly'}`,
    datePaid: null,
    paymentReference: null,
    startDate: next.startDate,
    endDate: next.endDate,
    createdBy: 'system',
    invoiceNumber,
  };
}

/// The period a payment made at [paidAt] covers.
export function paidPeriod(
  billingFrequency: Subscription['billingFrequency'],
  paidAt: Date,
): { startDate: Date; endDate: Date } {
  return getInvoiceStartDateAndEndDate({ startDate: paidAt, billingFrequency });
}

/// When a paid plan stops working if its renewal isn't paid.
export function graceEndsAt(endDate: Date): Date {
  return new Date(
    new Date(endDate).getTime() + configuration().billing.graceDays * DAY_MS,
  );
}

/// The first moment of [now]'s calendar month (UTC, Ghana's time).
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const daysFromNow = (days: number, now = new Date()) =>
  new Date(now.getTime() + days * DAY_MS);

/// To the pesewa: a yearly discount can leave more decimals.
export const roundCedis = (n: number) => Math.round(n * 100) / 100;
