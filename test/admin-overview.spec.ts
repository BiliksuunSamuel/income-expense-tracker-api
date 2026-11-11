import {
  BillingFrequency,
  InvoiceKind,
  PaymentStatus,
  SubscriptionStatus,
} from 'src/enums';
import { AdminOverviewService } from 'src/services/admin-overview.service';
import { model } from './support/fake-model';

const now = new Date('2026-11-20T12:00:00Z');
const at = (iso: string) => new Date(iso);

function setup() {
  const users = model([
    { id: 'u1', firstName: 'Ama', lastName: 'Owusu', createdAt: at('2026-11-02T09:00:00Z'), isGoogleAuth: true },
    { id: 'u2', firstName: 'Kofi', lastName: '', createdAt: at('2026-11-10T09:00:00Z') },
    { id: 'u3', phoneNumber: '233241234567', createdAt: at('2026-10-05T09:00:00Z') },
    { id: 'u4', firstName: 'Esi', lastName: 'Quaye', createdAt: at('2026-09-01T09:00:00Z') },
  ]);
  const plans = model([
    { id: 'free', title: 'Regular', price: 0, yearlyDiscount: 0, maxNumberOfTransactions: 50 },
    { id: 'premium', title: 'Premium', price: 20, yearlyDiscount: 10, maxNumberOfTransactions: 5000 },
  ]);
  const subscriptions = model([
    { id: 's1', userId: 'u1', billingPlanId: 'premium', planTitle: 'Premium', isActive: true, status: SubscriptionStatus.Active, billingFrequency: BillingFrequency.Monthly, endDate: at('2026-12-02T00:00:00Z') },
    { id: 's2', userId: 'u2', billingPlanId: 'premium', planTitle: 'Premium', isActive: true, status: SubscriptionStatus.Active, billingFrequency: BillingFrequency.Yearly, endDate: at('2027-11-10T00:00:00Z') },
    // Ended two days ago, renewal unpaid: in its grace days.
    { id: 's3', userId: 'u3', billingPlanId: 'premium', planTitle: 'Premium', isActive: true, status: SubscriptionStatus.Active, billingFrequency: BillingFrequency.Monthly, endDate: at('2026-11-18T00:00:00Z') },
    { id: 's4', userId: 'u3', billingPlanId: 'free', planTitle: 'Regular', isActive: false, status: SubscriptionStatus.Closed },
    { id: 's5', userId: 'u4', billingPlanId: 'free', planTitle: 'Regular', isActive: true, status: SubscriptionStatus.Active, billingFrequency: BillingFrequency.Monthly },
  ]);
  const invoices = model([
    { id: 'i1', userId: 'u1', subscriptionId: 's1', invoiceNumber: 'INV-2026-000001', kind: InvoiceKind.New, status: PaymentStatus.Completed, amount: 20, datePaid: at('2026-11-02T10:00:00Z'), updatedAt: at('2026-11-02T10:00:00Z'), paymentMethod: 'MoMo · MTN •••4567' },
    { id: 'i2', userId: 'u2', subscriptionId: 's2', invoiceNumber: 'INV-2026-000002', kind: InvoiceKind.New, status: PaymentStatus.Completed, amount: 216, datePaid: at('2026-11-10T10:00:00Z'), updatedAt: at('2026-11-10T10:00:00Z') },
    { id: 'i0', userId: 'u3', subscriptionId: 's3', invoiceNumber: 'INV-2026-000000', kind: InvoiceKind.New, status: PaymentStatus.Completed, amount: 20, datePaid: at('2026-10-18T10:00:00Z'), updatedAt: at('2026-10-18T10:00:00Z') },
    { id: 'i3', userId: 'u3', subscriptionId: 's3', invoiceNumber: 'INV-2026-000003', kind: InvoiceKind.Renewal, status: PaymentStatus.Failed, amount: 20, dueDate: at('2026-11-18T00:00:00Z'), updatedAt: at('2026-11-20T08:00:00Z'), failureReason: 'Approval timed out' },
    { id: 'i4', userId: 'u1', subscriptionId: 's1', invoiceNumber: 'INV-2026-000004', kind: InvoiceKind.Renewal, status: PaymentStatus.Processing, amount: 20, dueDate: at('2026-12-02T00:00:00Z'), paymentStartedAt: at('2026-11-20T10:00:00Z'), updatedAt: at('2026-11-20T10:00:00Z') },
    // A free plan's invoice is never revenue.
    { id: 'i5', userId: 'u2', subscriptionId: 's4', invoiceNumber: 'INV-2026-000005', kind: InvoiceKind.New, status: PaymentStatus.Completed, amount: 0, datePaid: at('2026-11-01T10:00:00Z') },
  ]);
  const transactions = model([
    // Esi, on Regular: 45 of 50 this month.
    ...Array.from({ length: 45 }, () => ({ userId: 'u4', recordedAt: at('2026-11-15T09:00:00Z') })),
    // Ama: today, and earlier this week.
    { userId: 'u1', recordedAt: at('2026-11-20T08:00:00Z') },
    { userId: 'u1', recordedAt: at('2026-11-17T08:00:00Z') },
    // Kofi: last month only.
    { userId: 'u2', recordedAt: at('2026-10-30T08:00:00Z') },
  ]);
  const service = new AdminOverviewService(users as any, subscriptions as any, invoices as any, plans as any, transactions as any);
  return { service };
}

describe('Admin overview', () => {
  it("adds up this month's revenue, split by monthly and yearly plans", async () => {
    const { data } = await setup().service.overview(now);
    expect(data.revenue).toEqual({ thisMonth: 236, lastMonth: 20, monthlyPlans: 20, yearlyPlans: 216 });
    expect(data.newPaidThisMonth).toBe(2);
  });

  it('counts people, paid plans and this month\'s sign-ups', async () => {
    const { data } = await setup().service.overview(now);
    expect(data.users).toBe(4);
    expect(data.paidUsers).toBe(3);
    expect(data.signups).toEqual({ thisMonth: 2, google: 1 });
  });

  it('lists what needs an admin, with names', async () => {
    const { data } = await setup().service.overview(now);
    expect(data.renewalsDueNext7Days).toBe(1);
    expect(data.attention).toEqual([
      { kind: 'failed_payments', count: 1, names: ['233241234567'] },
      { kind: 'waiting_payments', count: 1, names: ['Ama Owusu'] },
      { kind: 'overdue_renewals', count: 1, names: ['233241234567'] },
    ]);
  });

  it('shows recent payments with the plan, never a free one', async () => {
    const { data } = await setup().service.overview(now);
    expect(data.recentPayments.map((p) => p.id).sort()).toEqual(['i0', 'i1', 'i2', 'i3', 'i4']);
    expect(data.recentPayments.find((p) => p.id === 'i2')).toMatchObject({
      userName: 'Kofi',
      planTitle: 'Premium',
      billingFrequency: BillingFrequency.Yearly,
      amount: 216,
      currency: 'GHS',
    });
  });

  it('charts revenue and sign-ups by day, oldest first', async () => {
    const { data } = await setup().service.overview(now);
    expect(data.revenueByDay).toHaveLength(30);
    expect(data.revenueByDay.at(-1).date).toBe('2026-11-20');
    expect(data.revenueByDay.find((d) => d.date === '2026-11-10').amount).toBe(216);
    expect(data.revenueByMonth.at(-1)).toEqual({ month: '2026-11', amount: 236 });
    expect(data.revenueByMonth.at(-2)).toEqual({ month: '2026-10', amount: 20 });
    expect(data.signupsByDay.find((d) => d.date === '2026-11-02')).toEqual({ date: '2026-11-02', google: 1, phone: 0 });
  });

  it('counts active people, recurring revenue and the plan mix', async () => {
    const { data } = await setup().service.overview(now);
    // Esi's entries on the 15th fall in the last 7 days too.
    expect(data.active).toEqual({ today: 1, week: 2, month: 2 });
    // Two monthly Premium (20 each) and one yearly (216 / 12 = 18).
    expect(data.recurring.monthly).toBe(58);
    expect(data.recurring.plans).toEqual([
      { title: 'Regular', count: 1 },
      { title: 'Premium', count: 3 },
    ]);
  });

  it('finds people on the free plan near their monthly limit', async () => {
    const { data } = await setup().service.overview(now);
    expect(data.nearLimit).toEqual({ count: 1, limit: 50, people: [{ id: 'u4', name: 'Esi Quaye', used: 45 }] });
  });
});
