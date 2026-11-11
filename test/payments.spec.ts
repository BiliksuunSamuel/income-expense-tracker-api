import { createHmac } from 'crypto';
import { PaymentStatus, SubscriptionStatus, BillingFrequency } from 'src/enums';
import { InvoiceService } from 'src/services/invoice.service';
import { SubscriptionService } from 'src/services/subscription.service';
import {
  escapeHtml,
  isValidPaystackSignature,
  paystackAmount,
  toChargeCheck,
} from 'src/utils/paystack';

process.env.PaystackSecretKey = 'sk_test_example';
process.env.ApiBaseUrl = 'https://api.example.com';

const user = { id: 'u1', email: 'ama@example.com', phoneNumber: '', tokenId: 't' };

/// A tiny in-memory stand-in for a Mongoose model: enough of find, update
/// and $in / $ne / $or for these services.
function model(rows: any[]) {
  const matches = (row: any, q: any): boolean =>
    Object.entries(q).every(([k, v]: [string, any]) => {
      if (k === '$or') return v.some((part: any) => matches(row, part));
      const value = row[k];
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('$in' in v) return v.$in.includes(value);
        if ('$ne' in v) return value !== v.$ne;
        if ('$gte' in v) return value >= v.$gte;
      }
      if (Array.isArray(value)) return value.includes(v);
      return value === v;
    });
  const apply = (row: any, update: any) => {
    const { $set, $push, ...plain } = update;
    Object.assign(row, plain, $set ?? {});
    for (const [k, v] of Object.entries($push ?? {})) {
      row[k] = [...(row[k] ?? []), v];
    }
  };
  const lean = <T>(value: T) => ({ lean: async () => value, then: (r: any) => r(value) });
  return {
    rows,
    findOne: (q: any) => lean(rows.find((r) => matches(r, q)) ?? null),
    find: (q: any) => {
      const found = rows.filter((r) => matches(r, q));
      const chain: any = { skip: () => chain, limit: () => chain, sort: () => chain, lean: async () => found };
      return chain;
    },
    findOneAndUpdate: (q: any, update: any) => {
      const row = rows.find((r) => matches(r, q));
      if (row) apply(row, update);
      return lean(row ? { ...row } : null);
    },
    updateOne: async (q: any, update: any) => {
      const row = rows.find((r) => matches(r, q));
      if (row) apply(row, update);
    },
    updateMany: async (q: any, update: any) => {
      rows.filter((r) => matches(r, q)).forEach((r) => apply(r, update));
    },
    create: async (doc: any) => {
      rows.push({ ...doc });
      return { toObject: () => ({ ...doc }) };
    },
    countDocuments: async (q: any) => rows.filter((r) => matches(r, q)).length,
  };
}

function setup() {
  const plans = model([
    { id: 'free', title: 'Regular', price: 0, yearlyDiscount: 0, maxNumberOfTransactions: 50 },
    { id: 'premium', title: 'Premium', price: 20, yearlyDiscount: 10, maxNumberOfTransactions: 5000 },
  ]);
  const subscriptions = model([
    { id: 's-old', userId: 'u1', isActive: true, status: SubscriptionStatus.Active, billingPlanId: 'free', planTitle: 'Regular', billingFrequency: BillingFrequency.Monthly },
  ]);
  const invoices = model([]);
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
  const invoiceService = new InvoiceService(invoices as any, paystack as any, subscriptions as any);
  const subscriptionService = new SubscriptionService(
    subscriptions as any,
    plans as any,
    invoiceService,
    {} as any,
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
  return { plans, subscriptions, invoices, paystack, invoiceService, subscriptionService, paid };
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
