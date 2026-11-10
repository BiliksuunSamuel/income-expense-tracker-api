import { TransactionFilter } from 'src/dtos/transaction/transaction.filter.dto';

/** [text] matched literally, ignoring case. */
export function literalPattern(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function day(value: unknown, end: boolean): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return null;
  return new Date(end ? d.setHours(23, 59, 59, 999) : d.setHours(0, 0, 0, 0));
}

/** The Mongo query for [userId]'s transactions matching [filter]. Every
 * value is read as plain text or a number, never as an operator. */
export function transactionQuery(
  filter: TransactionFilter,
  userId: string,
): Record<string, unknown> {
  const query: Record<string, any> = { userId };
  const currency = str(filter.currency);
  if (currency) query.currency = currency;
  const type = str(filter.type);
  if (type) query.type = type;
  const budgetId = str(filter.budgetId);
  if (budgetId) query.budgetId = budgetId;
  const account = str(filter.account);
  if (account) query.account = account;
  if (filter.repeatTransaction != null) {
    query.repeatTransaction = String(filter.repeatTransaction) === 'true';
  }

  const categories = [
    str(filter.category),
    ...(str(filter.categories)?.split(',') ?? []).map((c) => str(c)),
  ].filter((c): c is string => c != null);
  if (categories.length === 1) query.category = categories[0];
  if (categories.length > 1) query.category = { $in: categories };

  const min = num(filter.minAmount);
  const max = num(filter.maxAmount);
  if (min != null || max != null) {
    query.amount = {
      ...(min != null && { $gte: min }),
      ...(max != null && { $lte: max }),
    };
  }

  const from = day(filter.startDate, false);
  const to = day(filter.endDate, true);
  if (from || to) {
    query.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  }

  const text = str(filter.query);
  if (text) {
    const pattern = literalPattern(text.slice(0, 100));
    const or: Record<string, unknown>[] = [
      { category: pattern },
      { description: pattern },
    ];
    // "45" finds 45.00 and 45.50; "45.5" finds 45.50.
    const amount = num(text.replace(/,/g, ''));
    if (amount != null && text.includes('.')) or.push({ amount });
    if (amount != null && !text.includes('.')) {
      const whole = Math.trunc(amount);
      or.push({ amount: { $gte: whole, $lt: whole + 1 } });
    }
    query.$or = or;
  }
  return query;
}
