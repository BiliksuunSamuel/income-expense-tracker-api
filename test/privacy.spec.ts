import { PrivacyService } from 'src/services/privacy.service';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { SubscriptionStatus } from 'src/enums';
import { cloudinaryPublicId, withoutPrivateFields } from 'src/utils/privacy';
import { csvCell, exportRow, toCsv } from 'src/utils/export-csv';

const user = { id: 'u1', email: 'ama@example.com' } as UserJwtDetails;

function model(docs: any[] = []) {
  const lean = (v: any) => ({ lean: async () => v, sort: () => ({ lean: async () => v }) });
  return {
    findOne: jest.fn(() => lean(docs[0] ?? null)),
    find: jest.fn(() => lean(docs)),
    deleteMany: jest.fn(async () => ({})),
    deleteOne: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({})),
  };
}

function setup(over: Record<string, any> = {}) {
  const m = {
    users: model([{ id: 'u1', firstName: 'Ama', password: 'hash', fcmToken: 'tok', _id: 'x' }]),
    transactions: model([{ id: 't1', invoiceUrl: 'https://res.cloudinary.com/demo/image/upload/v17/IncomeExpenseInvoices/abc.jpg' }]),
    accounts: model(),
    transfers: model(),
    categories: model(),
    budgets: model(),
    budgetCategories: model(),
    repeats: model(),
    subscriptions: model(),
    invoices: model(),
    ...over,
  };
  const images = { deleteCloudinaryImage: jest.fn(async () => ({})) };
  const service = new PrivacyService(
    m.users as any,
    m.transactions as any,
    m.accounts as any,
    m.transfers as any,
    m.categories as any,
    m.budgets as any,
    m.budgetCategories as any,
    m.repeats as any,
    m.subscriptions as any,
    m.invoices as any,
    images as any,
  );
  return { service, m, images };
}

describe('downloading your data', () => {
  it('gives everything as JSON without secrets', async () => {
    const { service } = setup();
    const res = await service.exportData(user);
    expect(res.data.fileName).toMatch(/^ie-tracker-data-\d{4}-\d{2}-\d{2}\.json$/);
    const bundle = JSON.parse(Buffer.from(res.data.content, 'base64').toString('utf8'));
    expect(bundle.profile).toEqual({ id: 'u1', firstName: 'Ama' });
    expect(bundle.transactions[0].id).toBe('t1');
    expect(Object.keys(bundle)).toEqual(
      expect.arrayContaining(['accounts', 'categories', 'transfers', 'repeats', 'budgets', 'invoices']),
    );
  });
});

describe('deleting the account', () => {
  it('needs the confirmation word', async () => {
    const { service, m } = setup();
    const res = await service.deleteAccount(user, 'yes');
    expect(res.code).toBe(400);
    expect(m.users.deleteOne).not.toHaveBeenCalled();
  });

  it('removes the data, stops the plan, keeps payment records', async () => {
    const { service, m, images } = setup();
    const res = await service.deleteAccount(user, 'DELETE');
    expect(res.code).toBe(200);
    for (const k of ['transactions', 'accounts', 'transfers', 'repeats']) {
      expect(m[k].deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    }
    expect(m.budgets.deleteMany).toHaveBeenCalledWith({ createdBy: 'u1' });
    expect(m.budgetCategories.deleteMany).toHaveBeenCalledWith({ createdBy: 'u1' });
    expect(m.categories.deleteMany).toHaveBeenCalledWith({ creatorId: 'u1' });
    expect(m.subscriptions.updateMany).toHaveBeenCalledWith(
      { userId: 'u1' },
      { isActive: false, status: SubscriptionStatus.Cancelled },
    );
    expect(m.invoices.deleteMany).not.toHaveBeenCalled();
    expect(m.users.deleteOne).toHaveBeenCalledWith({ id: 'u1' });
    expect(images.deleteCloudinaryImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'IncomeExpenseInvoices/abc' }),
    );
  });

  it('keeps the user if removing their data fails, so it can be retried', async () => {
    const failing = model();
    failing.deleteMany.mockRejectedValue(new Error('db down'));
    const { service, m } = setup({ transfers: failing });
    const res = await service.deleteAccount(user, 'DELETE');
    expect(res.code).toBe(500);
    expect(m.users.deleteOne).not.toHaveBeenCalled();
  });
});

describe('export helpers', () => {
  it('never lets a cell run as a formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+233 24')).toBe("'+233 24");
    expect(csvCell('Lunch, waakye')).toBe('"Lunch, waakye"');
    expect(csvCell(-12.5)).toBe('-12.5');
  });

  it('starts with a BOM so Excel reads GH₵', () => {
    expect(toCsv([['GH₵']]).startsWith('﻿GH₵')).toBe(true);
  });

  it('names the account and links the receipt', () => {
    const row = exportRow(
      { id: 't', createdAt: new Date(2026, 10, 10, 9, 5), type: 'Expense', category: 'Food', description: 'Lunch', amount: 45.5, currency: 'GHS', account: 'momo', invoiceUrl: 'https://r' } as any,
      (id) => (id === 'momo' ? 'MTN MoMo' : id),
    );
    expect(row).toEqual(['2026-11-10 09:05', 'Expense', 'Food', 'Lunch', '45.50', 'GHS', 'MTN MoMo', 'https://r', 't']);
  });

  it('finds the Cloudinary id in a URL', () => {
    expect(cloudinaryPublicId('https://res.cloudinary.com/demo/image/upload/v1712/IncomeExpenseInvoices/abc.pdf')).toBe('IncomeExpenseInvoices/abc');
    expect(cloudinaryPublicId('not a url')).toBeNull();
    expect(withoutPrivateFields({ id: 'u', password: 'p', tokenId: 't' } as any)).toEqual({ id: 'u' });
  });
});
