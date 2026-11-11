import { createHmac } from 'crypto';
import { InvoiceKind, PaymentStatus, SubscriptionStatus, BillingFrequency } from 'src/enums';
import { InvoiceService } from 'src/services/invoice.service';
import { SubscriptionService } from 'src/services/subscription.service';
import { BillingCycleService } from 'src/services/billing-cycle.service';
import { InvoiceNumberService } from 'src/services/invoice-number.service';
import { SubscriptionMiddleware } from 'src/middleware/subscription.middleware';
import { addMonths } from 'src/utils';
import { model } from './support/fake-model';
import {
  escapeHtml,
  isValidPaystackSignature,
  paystackAmount,
  toChargeCheck,
} from 'src/utils/paystack';

process.env.PaystackSecretKey = 'sk_test_example';
process.env.ApiBaseUrl = 'https://api.example.com';

const user = { id: 'u1', email: 'ama@example.com', phoneNumber: '', tokenId: 't' };

function setup() {
  const plans = model([
    { id: 'free', title: 'Regular', price: 0, yearlyDiscount: 0, maxNumberOfTransactions: 50 },
    { id: 'premium', title: 'Premium', price: 20, yearlyDiscount: 10, maxNumberOfTransactions: 5000 },
  ]);
  const subscriptions = model([
    { id: 's-old', userId: 'u1', isActive: true, status: SubscriptionStatus.Active, billingPlanId: 'free', planTitle: 'Regular', billingFrequency: BillingFrequency.Monthly, maxNumberOfTransactions: 50, endDate: new Date('2027-11-01') },
  ]);
  const invoices = model([]);
  const transactions = model([]);
  // Paystack: what verify answers, per reference.
  const paystack = {
    answers: new Map<string, any>(),
    createCharge: jest.fn(async ({ reference }: any) => ({
      reference,
      checkoutUrl: `https://checkout.paystack.com/${reference}`,
    })),
    checkCharge: jest.fn(async (reference: string, amount: number) =>
      toChargeCheck(
        paystack.answers.get(reference) ?? { status: 'ongoing', reference, amount: 0, currency: 'GHS' },
        paystackAmount(amount),
      ),
    ),
  };
  const numbers = new InvoiceNumberService(model([]) as any);
  const notices = { paid: jest.fn(), renewalDue: jest.fn(), expired: jest.fn() };
  const invoiceService = new InvoiceService(invoices as any, paystack as any, subscriptions as any, numbers, notices as any);
  const billing = new BillingCycleService(
    subscriptions as any,
    plans as any,
    invoices as any,
    transactions as any,
    invoiceService,
    notices as any,
  );
  const subscriptionService = new SubscriptionService(
    subscriptions as any,
    plans as any,
    invoiceService,
    {} as any,
    billing,
    invoices as any,
  );
  const paid = (reference: string, amount = 2000) =>
    paystack.answers.set(reference, {
      id: 99,
      status: 'success',
      reference,
      amount,
      currency: 'GHS',
      channel: 'mobile_money',
      paid_at: '2026-11-11T10:00:00.000Z',
      authorization: { bank: 'MTN', mobile_money_number: '0241234567' },
    });
  return { plans, subscriptions, invoices, transactions, paystack, invoiceService, subscriptionService, billing, notices, paid };
}

describe('Paystack helpers', () => {
  it('asks Paystack for pesewas, rounded, never zero', () => {
    expect(paystackAmount(20)).toBe(2000);
    expect(paystackAmount(216.004)).toBe(21600);
    expect(paystackAmount(0)).toBe(1);
  });

  it('counts a charge only when it succeeded for the right amount and currency', () => {
    const tx = { status: 'success', reference: 'r', amount: 2000, currency: 'GHS' };
    expect(toChargeCheck(tx, 2000, 'GHS').status).toBe(PaymentStatus.Completed);
    expect(toChargeCheck({ ...tx, amount: 20 }, 2000, 'GHS').status).toBe(PaymentStatus.Failed);
    expect(toChargeCheck({ ...tx, currency: 'NGN' }, 2000, 'GHS').status).toBe(PaymentStatus.Failed);
    expect(toChargeCheck({ ...tx, status: 'abandoned' }, 2000, 'GHS').status).toBe(PaymentStatus.Processing);
    expect(toChargeCheck({ ...tx, status: 'failed', gateway_response: 'Declined' }, 2000, 'GHS')).toMatchObject({
      status: PaymentStatus.Failed,
      failureReason: 'Declined',
    });
  });

  it("checks the webhook's signature over the exact body", () => {
    const raw = Buffer.from('{"event":"charge.success"}');
    const good = createHmac('sha512', 'key').update(raw).digest('hex');
    expect(isValidPaystackSignature(raw, good, 'key')).toBe(true);
    expect(isValidPaystackSignature(Buffer.from('{"event":"x"}'), good, 'key')).toBe(false);
    expect(isValidPaystackSignature(raw, 'short', 'key')).toBe(false);
    expect(isValidPaystackSignature(raw, good, '')).toBe(false);
  });

  it('escapes text put into the redirect page', () => {
    expect(escapeHtml('"><script>x</script>')).not.toContain('<');
  });
});

describe('Buying a plan', () => {
  it('keeps the current plan until the new one is paid, and returns the checkout', async () => {
    const { subscriptionService, subscriptions } = setup();
    const res = await subscriptionService.buySubscription(
      { billingPlanId: 'premium', billingFrequency: BillingFrequency.Monthly },
      user,
    );
    expect(res.code).toBe(200);
    expect(res.data.status).toBe(SubscriptionStatus.Pending);
    expect(res.data.invoice.checkoutUrl).toMatch(/^https:\/\/checkout\.paystack\.com\//);
    expect(res.data.invoice.callbackUrl).toBe('https://api.example.com/api/invoices/update-status');
    expect(subscriptions.rows.find((s) => s.id === 's-old')).toMatchObject({ isActive: true });
  });

  it('switches plans once Paystack confirms, and only once', async () => {
    const { subscriptionService, invoiceService, subscriptions, invoices, paid } = setup();
    const res = await subscriptionService.buySubscription(
      { billingPlanId: 'premium', billingFrequency: BillingFrequency.Monthly },
      user,
    );
    const invoice = res.data.invoice;

    const waiting = await invoiceService.confirmInvoice(invoice.id, user);
    expect(waiting.data.status).toBe(PaymentStatus.Processing);

    paid(invoice.paymentReference);
    const done = await invoiceService.confirmInvoice(invoice.id, user);
    expect(done.data).toMatchObject({ status: PaymentStatus.Completed, paymentMethod: 'MoMo · MTN •••4567' });
    expect(subscriptions.rows.find((s) => s.id === res.data.id)).toMatchObject({ isActive: true, status: SubscriptionStatus.Active });
    expect(subscriptions.rows.find((s) => s.id === 's-old')).toMatchObject({ isActive: false, status: SubscriptionStatus.Closed });

    // The webhook arriving afterwards changes nothing.
    const datePaid = invoices.rows[0].datePaid;
    await invoiceService.confirmReference(invoice.paymentReference);
    expect(invoices.rows[0].datePaid).toBe(datePaid);
  });

  it("never counts a payment Paystack hasn't confirmed, even from the redirect", async () => {
    const { subscriptionService, invoiceService, subscriptions } = setup();
    const res = await subscriptionService.buySubscription(
      { billingPlanId: 'premium', billingFrequency: BillingFrequency.Monthly },
      user,
    );
    const html = await invoiceService.handlePaymentCallback(res.data.invoice.paymentReference);
    expect(html).toContain('being confirmed');
    expect(subscriptions.rows.find((s) => s.id === res.data.id).isActive).toBe(false);
  });

  it('refuses a payment of the wrong amount', async () => {
    const { subscriptionService, invoiceService, paid } = setup();
    const res = await subscriptionService.buySubscription(
      { billingPlanId: 'premium', billingFrequency: BillingFrequency.Monthly },
      user,
    );
    paid(res.data.invoice.paymentReference, 20);
    const done = await invoiceService.confirmInvoice(res.data.invoice.id, user);
    expect(done.data.status).toBe(PaymentStatus.Failed);
  });

  it('starts a free plan straight away', async () => {
    const { subscriptionService, subscriptions } = setup();
    subscriptions.rows.length = 0;
    const res = await subscriptionService.buySubscription(
      { billingPlanId: 'free', billingFrequency: BillingFrequency.Monthly },
      user,
    );
    expect(res.data).toMatchObject({ isActive: true, status: SubscriptionStatus.Active, invoice: null });
  });
});

describe('Paying an invoice', () => {
  async function pending() {
    const s = setup();
    const res = await s.subscriptionService.buySubscription(
      { billingPlanId: 'premium', billingFrequency: BillingFrequency.Yearly },
      user,
    );
    return { ...s, invoice: res.data.invoice };
  }

  it('charges the yearly price with its discount', async () => {
    const { invoice, paystack } = await pending();
    expect(invoice.amount).toBe(216);
    expect(paystack.createCharge).toHaveBeenCalledWith(expect.objectContaining({ amount: 216, email: 'ama@example.com' }));
  });

  it("reopens the checkout under way instead of starting another", async () => {
    const { invoice, invoiceService, paystack } = await pending();
    const again = await invoiceService.payInvoiceAsync(invoice.id, user);
    expect(again.data.paymentReference).toBe(invoice.paymentReference);
    expect(paystack.createCharge).toHaveBeenCalledTimes(1);
  });

  it('still counts an earlier checkout that gets paid later', async () => {
    const { invoice, invoiceService, invoices, paid } = await pending();
    invoices.rows[0].paymentStartedAt = new Date(Date.now() - 60 * 60 * 1000);
    const second = await invoiceService.payInvoiceAsync(invoice.id, user);
    expect(second.data.paymentReference).not.toBe(invoice.paymentReference);

    paid(invoice.paymentReference, 21600);
    const settled = await invoiceService.confirmReference(invoice.paymentReference);
    expect(settled.status).toBe(PaymentStatus.Completed);
  });

  it("keeps other people's invoices out of reach", async () => {
    const { invoice, invoiceService } = await pending();
    const other = { ...user, id: 'u2' };
    expect((await invoiceService.getInvoiceById(invoice.id, other)).code).toBe(404);
    expect((await invoiceService.payInvoiceAsync(invoice.id, other)).code).toBe(404);
    expect((await invoiceService.confirmInvoice(invoice.id, other)).code).toBe(404);
  });

  it("won't take a second payment for a paid invoice", async () => {
    const { invoice, invoiceService, paid } = await pending();
    paid(invoice.paymentReference, 21600);
    await invoiceService.confirmInvoice(invoice.id, user);
    expect((await invoiceService.payInvoiceAsync(invoice.id, user)).code).toBe(409);
  });

  it('settles payments left open when re-checking', async () => {
    const { invoice, invoiceService, invoices, paid } = await pending();
    paid(invoice.paymentReference, 21600);
    await invoiceService.recheckOpenPayments();
    expect(invoices.rows[0].status).toBe(PaymentStatus.Completed);
  });
});

describe('The billing cycle', () => {
  const DAY = 24 * 60 * 60 * 1000;

  /// u1 on Premium monthly, paid, ending [endsInDays] from [now].
  async function onPremium(now: Date, endsInDays: number) {
    const s = setup();
    const res = await s.subscriptionService.buySubscription(
      { billingPlanId: 'premium', billingFrequency: BillingFrequency.Monthly },
      user,
    );
    s.paid(res.data.invoice.paymentReference);
    await s.invoiceService.confirmInvoice(res.data.invoice.id, user);
    const sub = s.subscriptions.rows.find((r) => r.id === res.data.id);
    sub.endDate = new Date(now.getTime() + endsInDays * DAY);
    return { ...s, sub };
  }

  it('counts periods in calendar months', () => {
    expect(addMonths(new Date('2026-01-31T09:00:00Z'), 1).toISOString()).toBe('2026-02-28T09:00:00.000Z');
    expect(addMonths(new Date('2026-11-11T09:00:00Z'), 12).toISOString()).toBe('2027-11-11T09:00:00.000Z');
  });

  it('numbers invoices in order', async () => {
    const { invoices } = await onPremium(new Date(), 30);
    expect(invoices.rows[0].invoiceNumber).toMatch(/^INV-\d{4}-000001$/);
  });

  it('sends one renewal invoice a few days before the end', async () => {
    const now = new Date();
    const { billing, invoices, notices, sub } = await onPremium(now, 2);
    await billing.runBillingCycle(now);
    await billing.runBillingCycle(now);
    const renewals = invoices.rows.filter((i) => i.kind === InvoiceKind.Renewal);
    expect(renewals).toHaveLength(1);
    expect(renewals[0]).toMatchObject({ status: PaymentStatus.Pending, amount: 20, dueDate: sub.endDate });
    expect(renewals[0].invoiceNumber).toMatch(/000002$/);
    expect(notices.renewalDue).toHaveBeenCalledTimes(1);
  });

  it('carries the plan on from its end date when the renewal is paid', async () => {
    const now = new Date();
    const { billing, invoices, invoiceService, paid, sub } = await onPremium(now, 2);
    const endsAt = sub.endDate;
    await billing.runBillingCycle(now);
    const renewal = invoices.rows.find((i) => i.kind === InvoiceKind.Renewal);
    const pay = await invoiceService.payInvoiceAsync(renewal.id, user);
    paid(pay.data.paymentReference);
    await invoiceService.confirmInvoice(renewal.id, user);
    expect(sub).toMatchObject({ isActive: true, status: SubscriptionStatus.Active });
    expect(sub.endDate.toISOString()).toBe(addMonths(endsAt, 1).toISOString());
  });

  it('keeps the plan through the grace days, then falls back to Regular', async () => {
    const now = new Date();
    const { billing, invoices, notices, subscriptions, sub } = await onPremium(now, -2);
    await billing.runBillingCycle(now);
    expect(sub.isActive).toBe(true);

    await billing.runBillingCycle(new Date(now.getTime() + 2 * DAY));
    expect(sub).toMatchObject({ isActive: false, status: SubscriptionStatus.Expired });
    expect(invoices.rows.find((i) => i.kind === InvoiceKind.Renewal).status).toBe(PaymentStatus.Cancelled);
    expect(subscriptions.rows.find((r) => r.id === 's-old')).toMatchObject({ isActive: true, status: SubscriptionStatus.Active });
    expect(notices.expired).toHaveBeenCalledTimes(1);
  });

  it('expires a lapsed plan as soon as the user is seen', async () => {
    const now = new Date();
    const { billing, sub } = await onPremium(now, -4);
    const access = await billing.access('u1', now);
    expect(sub.status).toBe(SubscriptionStatus.Expired);
    expect(access.subscription).toMatchObject({ id: 's-old', planTitle: 'Regular' });
  });

  it('withdraws the invoice of a choice replaced by a newer one', async () => {
    const { subscriptionService, invoiceService, invoices, paid } = setup();
    const first = await subscriptionService.buySubscription(
      { billingPlanId: 'premium', billingFrequency: BillingFrequency.Monthly },
      user,
    );
    await subscriptionService.buySubscription(
      { billingPlanId: 'premium', billingFrequency: BillingFrequency.Yearly },
      user,
    );
    const old = invoices.rows.find((i) => i.id === first.data.invoice.id);
    expect(old.status).toBe(PaymentStatus.Cancelled);
    expect((await invoiceService.payInvoiceAsync(old.id, user)).code).toBe(409);

    // Money that still arrives for its open checkout isn't lost.
    paid(old.paymentReference);
    await invoiceService.recheckOpenPayments();
    expect(old.status).toBe(PaymentStatus.Completed);
  });

  it('limits new entries per calendar month, and only new entries', async () => {
    const s = setup();
    const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) - DAY);
    for (let i = 0; i < 50; i++) {
      s.transactions.rows.push({ userId: 'u1', recordedAt: i < 10 ? lastMonth : new Date() });
    }
    const middleware = new SubscriptionMiddleware(
      { getAuthDetails: async () => ({ user }) } as any,
      s.billing,
    );
    const run = async (method: string, url: string) => {
      const res: any = { status: jest.fn(() => res), send: jest.fn(() => res) };
      const next = jest.fn();
      await middleware.use({ method, originalUrl: url, query: {} } as any, res, next);
      return { next, res };
    };

    expect((await run('POST', '/api/transactions')).next).toHaveBeenCalled();
    for (let i = 0; i < 10; i++) s.transactions.rows.push({ userId: 'u1', recordedAt: new Date() });
    const blocked = await run('POST', '/api/transactions');
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.status).toHaveBeenCalledWith(403);
    expect((await run('GET', '/api/transactions?page=1')).next).toHaveBeenCalled();
    expect((await run('PATCH', '/api/transactions/t1')).next).toHaveBeenCalled();
  });
});
