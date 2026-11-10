import {
  BudgetAlertKind,
  alertLevel,
  budgetAlertFor,
  budgetAlertMessage,
} from 'src/utils/budget-alerts';

const budget = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'b1',
    title: 'Food',
    amount: 500,
    receiveAlert: true,
    receiveAlertPercentage: 80,
    progressValue: 0,
    ...extra,
  }) as any;

describe('budget alerts', () => {
  it('reads the level as a percent or a fraction, 80% when unset', () => {
    expect(alertLevel({ receiveAlertPercentage: 80 })).toBe(0.8);
    expect(alertLevel({ receiveAlertPercentage: 0.9 })).toBe(0.9);
    expect(alertLevel({ receiveAlertPercentage: 0 })).toBe(0.8);
    expect(alertLevel({ receiveAlertPercentage: 100 })).toBe(0.8);
  });

  it('warns once when spending crosses the level', () => {
    expect(budgetAlertFor(budget(), 350, 400)).toBe(BudgetAlertKind.Nearing);
    expect(budgetAlertFor(budget(), 400, 420)).toBeNull();
    expect(budgetAlertFor(budget(), 100, 200)).toBeNull();
  });

  it('tells once when the limit is reached, even straight past the warning', () => {
    expect(budgetAlertFor(budget(), 420, 500)).toBe(BudgetAlertKind.Reached);
    expect(budgetAlertFor(budget(), 100, 650)).toBe(BudgetAlertKind.Reached);
    expect(budgetAlertFor(budget(), 520, 600)).toBeNull();
  });

  it('says nothing when alerts are off or spending went down', () => {
    expect(budgetAlertFor(budget({ receiveAlert: false }), 350, 600)).toBeNull();
    expect(budgetAlertFor(budget(), 600, 300)).toBeNull();
    expect(budgetAlertFor(budget({ amount: 0 }), 0, 10)).toBeNull();
  });

  it('words the pushes plainly and links to the budget', () => {
    const near = budgetAlertMessage(
      BudgetAlertKind.Nearing,
      budget({ progressValue: 410 }),
      'GHS',
    );
    expect(near.title).toBe('Food: 82% used');
    expect(near.body).toBe('GHS 90.00 left of GHS 500.00.');
    expect(near.data).toEqual({ type: 'budget', budgetId: 'b1' });
    const over = budgetAlertMessage(
      BudgetAlertKind.Reached,
      budget({ progressValue: 1250.5 }),
      'GHS',
    );
    expect(over.body).toBe(
      "You've spent GHS 1,250.50 of GHS 500.00, GHS 750.50 over.",
    );
  });
});
