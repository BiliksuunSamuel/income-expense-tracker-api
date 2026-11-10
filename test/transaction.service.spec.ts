jest.mock('nact', () => ({ dispatch: jest.fn() }));

import { TransactionService } from 'src/services/transaction.service';
import { TransactionRequest } from 'src/dtos/transaction/transaction.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { TransactionType } from 'src/enums';

const user = { id: 'u1', email: 'ama@example.com' } as UserJwtDetails;

function setup(
  owner: string | null = null,
  upload: unknown = { secure_url: 'https://res.example.com/r.jpg' },
) {
  const images = { cloudinaryUpload: jest.fn().mockResolvedValue(upload) };
  const repo = {
    getTransactionOwner: jest.fn().mockResolvedValue(owner),
    createTransaction: jest.fn().mockResolvedValue(true),
    getTransactionById: jest.fn().mockResolvedValue(null),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn().mockResolvedValue(null),
  };
  const subscriptions = {
    getUserActiveSubscriptionWithInvoiceAsync: jest.fn().mockResolvedValue(null),
  };
  const recurring = { createFromTransaction: jest.fn() };
  const accounts = {
    resolveAccountId: jest.fn(async (_u, requested) =>
      requested === 'momo' ? 'momo' : 'cash',
    ),
  };
  const service = new TransactionService(
    repo as any,
    images as any,
    {} as any,
    {} as any,
    subscriptions as any,
    recurring as any,
    accounts as any,
    {} as any,
  );
  return { service, repo, images };
}

const request = (extra: Partial<TransactionRequest> = {}) =>
  ({
    type: TransactionType.Expense,
    amount: 25,
    currency: 'GHS',
    category: 'food',
    description: 'Lunch',
    repeatTransaction: false,
    ...extra,
  }) as TransactionRequest;

describe('creating a transaction', () => {
  it('keeps the id the app made', async () => {
    const { service, repo } = setup();
    await service.createTransaction(request({ id: 'abc12345-0001' }), user);
    expect(repo.createTransaction.mock.calls[0][0].id).toBe('abc12345-0001');
  });

  it('saves a retried create once', async () => {
    const { service, repo } = setup('u1');
    const res = await service.createTransaction(
      request({ id: 'abc12345-0001' }),
      user,
    );
    expect(res.code).toBe(200);
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  it("refuses an id that is someone else's", async () => {
    const { service, repo } = setup('someone-else');
    const res = await service.createTransaction(
      request({ id: 'abc12345-0001' }),
      user,
    );
    expect(res.code).toBe(409);
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  it('files it under the date it happened', async () => {
    const { service, repo } = setup();
    await service.createTransaction(
      request({ date: '2026-03-14T09:30:00.000Z' }),
      user,
    );
    const saved = repo.createTransaction.mock.calls[0][0];
    expect(saved.createdAt.toISOString()).toBe('2026-03-14T09:30:00.000Z');
    expect(saved.month).toBe(new Date('2026-03-14T09:30:00.000Z').getMonth());
    expect(saved.year).toBe(2026);
    expect(saved.date).toBeUndefined();
  });
});

describe("another user's transaction", () => {
  it('is not found when reading or deleting', async () => {
    const { service, repo } = setup();
    expect((await service.getTransactionById('t1', user)).code).toBe(404);
    expect((await service.deleteTransaction('t1', user)).code).toBe(404);
    expect(repo.getTransactionById).toHaveBeenCalledWith('t1', 'u1');
    expect(repo.deleteTransaction).toHaveBeenCalledWith('t1', 'u1');
  });
});

describe('editing a transaction', () => {
  it('moves it to a new date when one is given', async () => {
    const { service, repo } = setup();
    repo.getTransactionById.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      month: 0,
      year: 2026,
    });
    repo.updateTransaction.mockResolvedValue({ id: 't1' });
    await service.updateTransaction(
      't1',
      request({ date: '2026-03-14T09:30:00.000Z' }),
      user,
    );
    const saved = repo.updateTransaction.mock.calls[0][2];
    expect(saved.createdAt.toISOString()).toBe('2026-03-14T09:30:00.000Z');
    expect(saved.year).toBe(2026);
  });

  it('keeps the date when none is given', async () => {
    const { service, repo } = setup();
    const original = new Date('2026-01-01T00:00:00.000Z');
    repo.getTransactionById.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      createdAt: original,
      month: 0,
      year: 2026,
    });
    repo.updateTransaction.mockResolvedValue({ id: 't1' });
    await service.updateTransaction('t1', request(), user);
    expect(repo.updateTransaction.mock.calls[0][2].createdAt).toBe(original);
  });
});

describe('the account of a transaction', () => {
  it("is the one sent when it's the user's, else their default", async () => {
    const { service, repo } = setup();
    await service.createTransaction(request({ account: 'momo' } as any), user);
    await service.createTransaction(request({ account: 'Default' } as any), user);
    expect(repo.createTransaction.mock.calls[0][0].account).toBe('momo');
    expect(repo.createTransaction.mock.calls[1][0].account).toBe('cash');
  });
});

describe('receipts', () => {
  const withReceipt = (extra: Partial<TransactionRequest> = {}) =>
    request({
      id: 'abc12345-0009',
      invoice: 'aGVsbG8=',
      invoiceFileName: 'receipt.jpg',
      invoiceFileType: 'jpg',
      ...extra,
    });

  it('saves the uploaded receipt with its name and type', async () => {
    const { service, repo } = setup();
    await service.createTransaction(withReceipt(), user);
    const saved = repo.createTransaction.mock.calls[0][0];
    expect(saved).toMatchObject({
      invoiceUrl: 'https://res.example.com/r.jpg',
      invoiceFileName: 'receipt.jpg',
      invoiceFileType: 'jpg',
    });
    expect(saved.invoice).toBeUndefined();
  });

  it('a failed upload saves nothing, so the app tries again', async () => {
    const { service, repo } = setup(null, null);
    const res = await service.createTransaction(withReceipt(), user);
    expect(res.code).toBe(502);
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  it('editing keeps the file type right and can take the receipt off', async () => {
    const { service, repo } = setup();
    repo.getTransactionById.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      invoiceUrl: 'https://old',
      invoiceFileName: 'old.jpg',
      invoiceFileType: 'jpg',
    });
    repo.updateTransaction.mockResolvedValue(true);
    await service.updateTransaction('t1', withReceipt({ invoiceFileType: 'png' }), user);
    expect(repo.updateTransaction.mock.calls[0][2].invoiceFileType).toBe('png');
    await service.updateTransaction('t1', request({ removeInvoice: true }), user);
    expect(repo.updateTransaction.mock.calls[1][2].invoiceUrl).toBeNull();
  });

  it('a failed upload while editing changes nothing', async () => {
    const { service, repo } = setup(null, null);
    repo.getTransactionById.mockResolvedValue({ id: 't1', userId: 'u1' });
    const res = await service.updateTransaction('t1', withReceipt(), user);
    expect(res.code).toBe(502);
    expect(repo.updateTransaction).not.toHaveBeenCalled();
  });
});
