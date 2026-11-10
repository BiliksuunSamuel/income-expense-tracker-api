import { AccountService } from 'src/services/account.service';
import { TransferService } from 'src/services/transfer.service';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AccountKind } from 'src/enums';
import { withBalances } from 'src/utils/accounts';

const user = { id: 'u1', email: 'ama@example.com' } as UserJwtDetails;

const account = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  userId: 'u1',
  name: id,
  kind: AccountKind.Cash,
  openingBalance: 0,
  isDefault: false,
  archived: false,
  createdAt: new Date('2026-01-01'),
  ...extra,
});

function repo(accounts: any[] = []) {
  return {
    list: jest.fn().mockResolvedValue(accounts),
    byId: jest.fn(async (id: string) => accounts.find((a) => a.id === id)),
    ownerOf: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (a) => a),
    update: jest.fn(async (_id, _u, c) => ({ ...accounts[0], ...c })),
    delete: jest.fn(async (id) => accounts.find((a) => a.id === id)),
    setDefault: jest.fn(),
    adoptOrphanTransactions: jest.fn().mockResolvedValue(12),
    isUsed: jest.fn().mockResolvedValue(false),
    totals: jest.fn().mockResolvedValue({
      income: new Map(),
      expense: new Map(),
      transferredOut: new Map(),
      transferredIn: new Map(),
    }),
  };
}

describe('balances', () => {
  it('opening + income − expenses − transfers out + transfers in', () => {
    const [momo] = withBalances([account('momo', { openingBalance: 100 })] as any, {
      income: new Map([['momo', 500]]),
      expense: new Map([['momo', 120.25]]),
      transferredOut: new Map([['momo', 50]]),
      transferredIn: new Map([['momo', 20.1]]),
    });
    expect(momo.balance).toBe(449.85);
  });
});

describe('the balance before a date', () => {
  it('is given alongside the current one when asked for', async () => {
    const r = repo([account('cash', { isDefault: true, openingBalance: 10 })]);
    r.totals.mockImplementation(async (_u: string, before?: Date) => ({
      income: new Map([['cash', before ? 100 : 150]]),
      expense: new Map(),
      transferredOut: new Map(),
      transferredIn: new Map(),
    }));
    const res = await new AccountService(r as any).getAccounts(
      user,
      '2026-01-01T00:00:00.000Z',
    );
    expect(res.data[0]).toMatchObject({ balance: 160, balanceBefore: 110 });
    expect(r.totals).toHaveBeenCalledWith('u1', new Date('2026-01-01T00:00:00.000Z'));
  });
});

describe('a user without accounts', () => {
  it('gets Cash as default, with earlier transactions moved into it', async () => {
    const r = repo([]);
    const service = new AccountService(r as any);
    const res = await service.getAccounts(user);
    expect(res.code).toBe(200);
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({ name: 'Cash', isDefault: true });
    const cashId = r.create.mock.calls[0][0].id;
    expect(r.adoptOrphanTransactions).toHaveBeenCalledWith('u1', cashId, [cashId]);
  });

  it("isn't given a second Cash once they have accounts", async () => {
    const r = repo([account('cash', { isDefault: true })]);
    await new AccountService(r as any).getAccounts(user);
    expect(r.create).not.toHaveBeenCalled();
  });
});

describe('resolving the account of a new transaction', () => {
  const r = repo([account('cash', { isDefault: true }), account('momo')]);
  const service = new AccountService(r as any);

  it('keeps one of the user’s accounts', async () => {
    expect(await service.resolveAccountId(user, 'momo')).toBe('momo');
  });

  it('uses the default for "Default", unknown or missing', async () => {
    expect(await service.resolveAccountId(user, 'Default')).toBe('cash');
    expect(await service.resolveAccountId(user, 'someone-elses')).toBe('cash');
    expect(await service.resolveAccountId(user)).toBe('cash');
  });
});

describe('removing an account', () => {
  it('refuses to delete one with history', async () => {
    const r = repo([account('cash', { isDefault: true }), account('momo')]);
    r.isUsed.mockResolvedValue(true);
    const res = await new AccountService(r as any).deleteAccount('momo', user);
    expect(res.code).toBe(409);
    expect(r.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete or archive the default', async () => {
    const r = repo([account('cash', { isDefault: true })]);
    const service = new AccountService(r as any);
    expect((await service.deleteAccount('cash', user)).code).toBe(400);
    expect(
      (await service.updateAccount('cash', { archived: true }, user)).code,
    ).toBe(400);
  });

  it("can't touch another user's account", async () => {
    const r = repo([]);
    r.byId.mockResolvedValue(undefined);
    const res = await new AccountService(r as any).deleteAccount('x', user);
    expect(res.code).toBe(404);
  });
});

describe('transfers', () => {
  const accounts = repo([account('cash'), account('momo')]);

  function service() {
    const transfers = {
      ownerOf: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (t) => t),
    };
    return { s: new TransferService(transfers as any, accounts as any), transfers };
  }

  it('moves money between two of the user’s accounts', async () => {
    const { s, transfers } = service();
    const res = await s.createTransfer(
      { fromAccountId: 'cash', toAccountId: 'momo', amount: 50.005, date: '2026-11-10T08:00:00.000Z' },
      user,
    );
    expect(res.code).toBe(200);
    expect(transfers.create.mock.calls[0][0]).toMatchObject({
      fromAccountId: 'cash',
      toAccountId: 'momo',
      amount: 50.01,
    });
  });

  it('refuses the same account twice, or one that isn’t theirs', async () => {
    const { s } = service();
    expect(
      (await s.createTransfer({ fromAccountId: 'cash', toAccountId: 'cash', amount: 5 }, user)).code,
    ).toBe(400);
    expect(
      (await s.createTransfer({ fromAccountId: 'cash', toAccountId: 'theirs', amount: 5 }, user)).code,
    ).toBe(404);
  });

  it('saves a retried transfer once', async () => {
    const { s, transfers } = service();
    transfers.ownerOf.mockResolvedValue('u1');
    const res = await s.createTransfer(
      { id: 'abc12345-0001', fromAccountId: 'cash', toAccountId: 'momo', amount: 5 },
      user,
    );
    expect(res.code).toBe(200);
    expect(transfers.create).not.toHaveBeenCalled();
  });
});
