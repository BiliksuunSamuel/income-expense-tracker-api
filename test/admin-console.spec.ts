import { AdminRole, AdminStatus, InvoiceKind, PaymentStatus, SubscriptionStatus, UserStatus } from 'src/enums';
import { AdminAuditService } from 'src/services/admin-audit.service';
import { AdminBillingService } from 'src/services/admin-billing.service';
import { AdminSetupService } from 'src/services/admin-setup.service';
import { AdminUsersService } from 'src/services/admin-users.service';
import { model } from './support/fake-model';

const owner: any = { id: 'a1', firstName: 'Abena', lastName: 'Owner', phoneNumber: '233241234567', role: AdminRole.Owner, status: AdminStatus.Active };

function setup() {
  const users = model([
    { id: 'u1', firstName: 'Ama', lastName: 'Owusu', email: 'ama@example.com', isGoogleAuth: true, status: UserStatus.Active, tokenId: 't1', createdAt: new Date('2026-11-01') },
    { id: 'u2', firstName: 'Kofi', phoneNumber: '233201112222', status: UserStatus.Active, tokenId: 't2', createdAt: new Date('2026-11-05') },
  ]);
  const plans = model([
    { id: 'free', title: 'Regular', price: 0, yearlyDiscount: 0, maxNumberOfTransactions: 50, features: [], unavailableFeatures: [] },
    { id: 'premium', title: 'Premium', price: 20, yearlyDiscount: 10, maxNumberOfTransactions: 5000, features: [], unavailableFeatures: [] },
  ]);
  const subscriptions = model([
    { id: 's1', userId: 'u1', billingPlanId: 'premium', planTitle: 'Premium', isActive: true, status: SubscriptionStatus.Active, maxNumberOfTransactions: 5000, endDate: new Date('2026-12-01') },
    { id: 's2', userId: 'u2', billingPlanId: 'free', planTitle: 'Regular', isActive: true, status: SubscriptionStatus.Active, maxNumberOfTransactions: 50 },
  ]);
  const invoices = model([
    { id: 'i1', userId: 'u1', subscriptionId: 's1', invoiceNumber: 'INV-2026-000001', kind: InvoiceKind.New, status: PaymentStatus.Completed, amount: 20, currency: 'GHS', paymentReference: 'r1', createdAt: new Date('2026-11-01') },
    { id: 'i2', userId: 'u2', subscriptionId: 's2', invoiceNumber: 'INV-2026-000002', kind: InvoiceKind.New, status: PaymentStatus.Pending, amount: 20, currency: 'GHS', paymentReference: null, createdAt: new Date('2026-11-06') },
  ]);
  const transactions = model([
    { userId: 'u1', recordedAt: new Date() },
    { userId: 'u1', recordedAt: new Date('2025-01-01') },
  ]);
  const admins = model([owner, { id: 'a2', firstName: 'Kwesi', phoneNumber: '233551112222', role: AdminRole.Admin, status: AdminStatus.Active }]);
  const auditRows = model([]);
  const audit = new AdminAuditService(auditRows as any);
  const invoiceService = { recheck: jest.fn(async (id: string) => invoices.rows.find((i) => i.id === id)) };
  const usersService = new AdminUsersService(users as any, subscriptions as any, invoices as any, transactions as any, model([]) as any, model([]) as any, plans as any, audit);
  const billing = new AdminBillingService(invoices as any, subscriptions as any, users as any, auditRows as any, invoiceService as any, audit);
  const setupService = new AdminSetupService(plans as any, subscriptions as any, admins as any, audit);
  return { users, plans, subscriptions, invoices, admins, auditRows, usersService, billing, setupService };
}

const page = { page: 1, pageSize: 20 };

describe('Console: users', () => {
  it('finds people by name, email or phone, and by paid or free plan', async () => {
    const { usersService } = setup();
    expect((await usersService.list({ query: 'ama@' }, page)).data.results.map((u) => u.name)).toEqual(['Ama Owusu']);
    expect((await usersService.list({ plan: 'paid' }, page)).data.results.map((u) => u.id)).toEqual(['u1']);
    expect((await usersService.list({ plan: 'free' }, page)).data.results.map((u) => u.id)).toEqual(['u2']);
  });

  it('shows counts of what someone keeps, never the entries', async () => {
    const { data } = await setup().usersService.detail('u1');
    expect(data.counts).toMatchObject({ entriesThisMonth: 1, entries: 2 });
    expect(data).not.toHaveProperty('transactions');
    expect(data.paidTotal).toBe(20);
  });

  it('suspends an account, ends its sessions, and restores it, in the log', async () => {
    const { usersService, users, auditRows } = setup();
    await usersService.suspend(owner, 'u2', 'Chargeback');
    expect(users.rows[1]).toMatchObject({ status: UserStatus.Inactive });
    expect(users.rows[1].tokenId).not.toBe('t2');
    expect((await usersService.suspend(owner, 'u2')).code).toBe(409);
    await usersService.restore(owner, 'u2');
    expect(users.rows[1].status).toBe(UserStatus.Active);
    expect(auditRows.rows.map((r) => r.summary)).toEqual(['Suspended Kofi: Chargeback', 'Restored Kofi']);
  });
});

describe('Console: payments and invoices', () => {
  it('lists only invoices someone started paying under Payments, with tab counts', async () => {
    const { billing } = setup();
    const payments = await billing.payments('all', undefined, page);
    expect(payments.data.results.map((i) => i.id)).toEqual(['i1']);
    const invoices = await billing.invoices('unpaid', undefined, page);
    expect(invoices.data.results.map((i) => i.id)).toEqual(['i2']);
    expect(invoices.data.counts).toMatchObject({ all: 2, unpaid: 1, paid: 1 });
  });

  it('marks only a paid invoice refunded', async () => {
    const { billing, invoices } = setup();
    expect((await billing.markRefunded(owner, 'i2')).code).toBe(409);
    const res = await billing.markRefunded(owner, 'i1', 'Charged twice');
    expect(res.data).toMatchObject({ status: PaymentStatus.Refunded, refundNote: 'Charged twice' });
    expect(invoices.rows[0].refundedAt).toBeInstanceOf(Date);
    expect(res.data.history[0].summary).toMatch(/Marked INV-2026-000001 \(GHS 20.00\) refunded/);
  });

  it("won't ask Paystack about an invoice nobody started paying", async () => {
    expect((await setup().billing.recheck(owner, 'i2')).code).toBe(409);
  });
});

describe('Console: plans and admins', () => {
  it('applies a new entry limit to everyone on the plan', async () => {
    const { setupService, subscriptions } = setup();
    await setupService.updatePlan(owner, 'premium', { price: 25, maxNumberOfTransactions: 8000 });
    expect(subscriptions.rows[0].maxNumberOfTransactions).toBe(8000);
  });

  it('keeps the free plan free and checks prices', async () => {
    const { setupService } = setup();
    expect((await setupService.updatePlan(owner, 'free', { price: 5 })).code).toBe(400);
    expect((await setupService.updatePlan(owner, 'premium', { price: -1 })).code).toBe(400);
    expect((await setupService.createPlan(owner, { title: 'Premium' as any, price: 30 })).code).toBe(409);
  });

  it("adds admins, and won't leave the console without an Owner", async () => {
    const { setupService, admins } = setup();
    expect((await setupService.addAdmin(owner, { phoneNumber: '0551112222', firstName: 'Kwesi' })).code).toBe(409);
    expect((await setupService.addAdmin(owner, { phoneNumber: '0209998888', firstName: 'Esi' })).code).toBe(201);
    expect((await setupService.updateAdmin(owner, 'a1', { role: AdminRole.Admin })).code).toBe(403);
    await setupService.updateAdmin(owner, 'a2', { status: AdminStatus.Suspended });
    expect(admins.rows[1]).toMatchObject({ status: AdminStatus.Suspended, sessionId: null });
  });
});
