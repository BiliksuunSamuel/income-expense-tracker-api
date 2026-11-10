import { AccountTotals } from 'src/repositories/account.repository';
import { Account } from 'src/schemas/account.schema';
import { AccountWithBalance } from 'src/dtos/account/account.request.dto';

/** Balance = opening balance + income − expenses − transfers out + in. */
export function withBalances(
  accounts: Account[],
  totals: AccountTotals,
  totalsBefore?: AccountTotals,
): AccountWithBalance[] {
  const get = (m: Map<string, number>, id: string) => m.get(id) ?? 0;
  const balance = (a: Account, t: AccountTotals) =>
    round2(
      (a.openingBalance ?? 0) +
        get(t.income, a.id) -
        get(t.expense, a.id) -
        get(t.transferredOut, a.id) +
        get(t.transferredIn, a.id),
    );
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    openingBalance: a.openingBalance ?? 0,
    isDefault: Boolean(a.isDefault),
    archived: Boolean(a.archived),
    createdAt: a.createdAt,
    balance: balance(a, totals),
    ...(totalsBefore && { balanceBefore: balance(a, totalsBefore) }),
  }));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A client-sent date, or now when missing or unreadable. */
export function dateOrNow(value?: string): Date {
  const parsed = value ? new Date(value) : null;
  return parsed && !isNaN(parsed.getTime()) ? parsed : new Date();
}
