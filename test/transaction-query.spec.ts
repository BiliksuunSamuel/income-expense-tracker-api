import { transactionQuery } from 'src/utils/transaction-query';

const q = (filter: Record<string, unknown>) =>
  transactionQuery(filter as any, 'u1') as Record<string, any>;

describe('the transaction query', () => {
  it('always keeps to the user', () => {
    expect(q({})).toEqual({ userId: 'u1' });
  });

  it('searches text literally, so symbols match themselves', () => {
    const query = q({ query: 'a.(b' });
    const pattern: RegExp = query.$or[0].category;
    expect(pattern.test('A.(B')).toBe(true);
    expect(pattern.test('axxb')).toBe(false);
  });

  it('a number also matches the amount', () => {
    expect(q({ query: '1,250' }).$or).toContainEqual({
      amount: { $gte: 1250, $lt: 1251 },
    });
    expect(q({ query: '45.5' }).$or).toContainEqual({ amount: 45.5 });
    expect(q({ query: 'lunch' }).$or).toHaveLength(2);
  });

  it('takes an amount range, either end open', () => {
    expect(q({ minAmount: '50' }).amount).toEqual({ $gte: 50 });
    expect(q({ minAmount: '50', maxAmount: '200' }).amount).toEqual({
      $gte: 50,
      $lte: 200,
    });
    expect(q({ maxAmount: 'abc' }).amount).toBeUndefined();
  });

  it('takes several categories', () => {
    expect(q({ categories: 'Food, Lunch,' }).category).toEqual({
      $in: ['Food', 'Lunch'],
    });
    expect(q({ category: 'Food' }).category).toBe('Food');
  });

  it('takes either end of a date range, whole days', () => {
    const from = q({ startDate: '2026-03-01' }).createdAt.$gte as Date;
    expect(from.getHours()).toBe(0);
    expect(q({ startDate: '2026-03-01' }).createdAt.$lte).toBeUndefined();
    const to = q({ endDate: '2026-03-31' }).createdAt.$lte as Date;
    expect(to.getHours()).toBe(23);
  });

  it('ignores operator objects sent in place of values', () => {
    const query = q({
      category: { $ne: 'x' },
      account: { $gt: '' },
      type: ['Income'],
      query: { $where: '1' },
    });
    expect(query).toEqual({ userId: 'u1' });
  });

  it('filters by account', () => {
    expect(q({ account: 'momo' }).account).toBe('momo');
  });
});
