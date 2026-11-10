import { Budget } from 'src/schemas/budget.schema';

export enum BudgetAlertKind {
  Nearing = 'Nearing',
  Reached = 'Reached',
}

/** The budget's warning level as a fraction. Older apps sent 0.8, current
 * ones send 80; unset means 80%. */
export function alertLevel(
  budget: Pick<Budget, 'receiveAlertPercentage'>,
): number {
  const raw = Number(budget.receiveAlertPercentage) || 0;
  const level = raw > 1 ? raw / 100 : raw;
  return level > 0 && level < 1 ? level : 0.8;
}

/** Which alert, if any, spending going from [before] to [after] crosses.
 * Each fires once on the way up; dropping back below and rising again (an
 * entry edited or removed) fires it again. */
export function budgetAlertFor(
  budget: Pick<Budget, 'amount' | 'receiveAlert' | 'receiveAlertPercentage'>,
  before: number,
  after: number,
): BudgetAlertKind | null {
  const amount = Number(budget.amount) || 0;
  if (!budget.receiveAlert || amount <= 0 || after <= before) return null;
  if (before < amount && after >= amount) return BudgetAlertKind.Reached;
  const warnAt = amount * alertLevel(budget);
  if (before < warnAt && after >= warnAt) return BudgetAlertKind.Nearing;
  return null;
}

function money(currency: string | undefined, n: number): string {
  const fixed = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${fixed}` : fixed;
}

/** The push for [kind]. */
export function budgetAlertMessage(
  kind: BudgetAlertKind,
  budget: Pick<Budget, 'id' | 'title' | 'amount' | 'progressValue'>,
  currency?: string,
): { title: string; body: string; data: Record<string, string> } {
  const spent = Number(budget.progressValue) || 0;
  const amount = Number(budget.amount) || 0;
  const data = { type: 'budget', budgetId: budget.id };
  if (kind === BudgetAlertKind.Reached) {
    const over = spent - amount;
    return {
      title: `${budget.title}: budget used up`,
      body:
        over > 0.004
          ? `You've spent ${money(currency, spent)} of ${money(currency, amount)}, ${money(currency, over)} over.`
          : `You've spent all ${money(currency, amount)} of this budget.`,
      data,
    };
  }
  const percent = Math.floor((spent / amount) * 100);
  return {
    title: `${budget.title}: ${percent}% used`,
    body: `${money(currency, amount - spent)} left of ${money(currency, amount)}.`,
    data,
  };
}
