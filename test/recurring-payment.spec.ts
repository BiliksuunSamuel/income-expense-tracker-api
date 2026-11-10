jest.mock('nact', () => ({ dispatch: jest.fn() }));

import { RecurringTransactionService } from 'src/services/recurring.transaction.service';
import { RecurringPaymentResult } from 'src/dtos/recurring-transaction/recurring.transaction.pay.dto';
import {
  RecurringTransactionStatus,
  TransactionRepeatFrequency,
  TransactionType,
} from 'src/enums';

const due = new Date('2026-11-14T08:00:00.000Z');

function setup(extra: Record<string, unknown> = {}) {
  const recurring: any = {
    id: 'r1',
    userId: 'u1',
    username: 'ama',
    type: TransactionType.Expense,
    amount: 800,
    currency: 'GHS',
    category: 'Rent',
    description: 'Rent',
    account: 'momo',
    budgetId: null,
    frequency: TransactionRepeatFrequency.Monthly,
    interval: 1,
    repeatUntil: null,
    nextRunAt: due,
    lastRunAt: null,
    status: RecurringTransactionStatus.Active,
    ...extra,
  };
  const created: any[] = [];
  const repo = {
    getById: jest.fn(async () => recurring),
    getExpired: jest.fn(async () => []),
    getDue: jest.fn(async () => [recurring]),
    update: jest.fn(),
    // Only the first claim of an occurrence wins.
    claimOccurrence: jest.fn(async (_id: string, at: Date, patch: any) => {
      if (recurring.status !== RecurringTransactionStatus.Active) return null;
      if (new Date(recurring.nextRunAt).getTime() !== at.getTime()) return null;
      Object.assign(recurring, patch);
      return recurring;
    }),
  };
  const transactions = {
    getTransactionById: jest.fn(async (id: string) => created.find((t) => t.id === id) ?? null),
    createTransaction: jest.fn(async (t: any) => {
      created.push(t);
      return true;
    }),
  };
  const users = { getByIdAsync: jest.fn(async () => null) };
  const service = new RecurringTransactionService(
    repo as any,
    transactions as any,
    {} as any,
    {} as any,
    users as any,
  );
  return { service, recurring, created, repo };
}

const pay = (transactionId = 'tx-00000001') => ({
  transactionId,
  dueAt: due.toISOString(),
});

describe('paying a repeat early', () => {
  it('records it with the given id and moves on to next month', async () => {
    const { service, recurring, created } = setup();
    const res = await service.payOccurrence('r1', 'u1', pay());
    expect(res.data).toBe(RecurringPaymentResult.Recorded);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ id: 'tx-00000001', amount: 800, account: 'momo' });
    expect(new Date(recurring.nextRunAt).getUTCMonth()).toBe(11);
  });

  it('a retry records nothing more', async () => {
    const { service, created } = setup();
    await service.payOccurrence('r1', 'u1', pay());
    const again = await service.payOccurrence('r1', 'u1', pay());
    expect(again.data).toBe(RecurringPaymentResult.AlreadyRecorded);
    expect(created).toHaveLength(1);
  });

  it('after the scheduler recorded it, paying adds nothing', async () => {
    const { service, created } = setup();
    await service.processDueRecurringTransactions();
    expect(created).toHaveLength(1);
    const res = await service.payOccurrence('r1', 'u1', pay('tx-00000002'));
    expect(res.data).toBe(RecurringPaymentResult.AlreadyRecorded);
    expect(created).toHaveLength(1);
  });

  it('after paying, the scheduler leaves that occurrence alone', async () => {
    const { service, created, repo } = setup();
    // The scheduler had already read it as due before the payment landed.
    const stale = { ...(await repo.getById()) };
    repo.getDue.mockResolvedValue([stale]);
    await service.payOccurrence('r1', 'u1', pay());
    await service.processDueRecurringTransactions();
    expect(created).toHaveLength(1);
  });

  it("someone else's repeat is not found", async () => {
    const { service } = setup({ userId: 'u2' });
    expect((await service.payOccurrence('r1', 'u1', pay())).code).toBe(404);
  });

  it('an ended repeat says so', async () => {
    const { service } = setup({ status: RecurringTransactionStatus.Closed });
    expect((await service.payOccurrence('r1', 'u1', pay())).code).toBe(409);
  });

  it('the last occurrence before its end closes the repeat', async () => {
    const { service, recurring } = setup({ repeatUntil: new Date('2026-12-01') });
    await service.payOccurrence('r1', 'u1', pay());
    expect(recurring.status).toBe(RecurringTransactionStatus.Closed);
  });
});
