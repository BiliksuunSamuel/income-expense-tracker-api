import { CategoryColor, CategoryIcon, CategoryKind } from 'src/enums';

export interface CategoryLook {
  icon: CategoryIcon;
  color: CategoryColor;
}

/** The categories a new user starts with. */
export const STARTER_CATEGORIES: (CategoryLook & {
  title: string;
  kind: CategoryKind;
})[] = [
  {
    kind: CategoryKind.Expense,
    title: 'Food',
    icon: CategoryIcon.Food,
    color: CategoryColor.Orange,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Transport',
    icon: CategoryIcon.Transport,
    color: CategoryColor.Blue,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Shopping',
    icon: CategoryIcon.Shopping,
    color: CategoryColor.Pink,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Bills',
    icon: CategoryIcon.Bills,
    color: CategoryColor.Yellow,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Airtime & data',
    icon: CategoryIcon.Airtime,
    color: CategoryColor.Teal,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Rent',
    icon: CategoryIcon.Rent,
    color: CategoryColor.Purple,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Health',
    icon: CategoryIcon.Health,
    color: CategoryColor.Red,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Education',
    icon: CategoryIcon.Education,
    color: CategoryColor.Blue,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Family',
    icon: CategoryIcon.Family,
    color: CategoryColor.Green,
  },
  {
    kind: CategoryKind.Expense,
    title: 'Other',
    icon: CategoryIcon.Other,
    color: CategoryColor.Grey,
  },
  {
    kind: CategoryKind.Income,
    title: 'Salary',
    icon: CategoryIcon.Salary,
    color: CategoryColor.Green,
  },
  {
    kind: CategoryKind.Income,
    title: 'Business',
    icon: CategoryIcon.Business,
    color: CategoryColor.Teal,
  },
  {
    kind: CategoryKind.Income,
    title: 'Gift',
    icon: CategoryIcon.Gift,
    color: CategoryColor.Pink,
  },
  {
    kind: CategoryKind.Income,
    title: 'Other',
    icon: CategoryIcon.Other,
    color: CategoryColor.Grey,
  },
];

const GUESSES: [RegExp, CategoryLook][] = [
  [
    /lunch|waakye|kenkey|jollof|snack|fast food|kfc|pizza/,
    { icon: CategoryIcon.FastFood, color: CategoryColor.Orange },
  ],
  [
    /food|restaurant|dinner|breakfast|chop|\beat/,
    { icon: CategoryIcon.Food, color: CategoryColor.Orange },
  ],
  [
    /grocer|market/,
    { icon: CategoryIcon.Groceries, color: CategoryColor.Green },
  ],
  [/fuel|petrol|gas/, { icon: CategoryIcon.Fuel, color: CategoryColor.Orange }],
  [
    /transport|trotro|taxi|uber|bolt|\bbus\b|\bcars?\b/,
    { icon: CategoryIcon.Transport, color: CategoryColor.Blue },
  ],
  [
    /cloth|fashion|shoe/,
    { icon: CategoryIcon.Clothing, color: CategoryColor.Pink },
  ],
  [/shop/, { icon: CategoryIcon.Shopping, color: CategoryColor.Pink }],
  [
    /electric|ecg|\blight\b|power/,
    { icon: CategoryIcon.Electricity, color: CategoryColor.Yellow },
  ],
  [/water/, { icon: CategoryIcon.Water, color: CategoryColor.Blue }],
  [
    /internet|wifi|broadband/,
    { icon: CategoryIcon.Internet, color: CategoryColor.Teal },
  ],
  [
    /airtime|data|phone|credit/,
    { icon: CategoryIcon.Airtime, color: CategoryColor.Teal },
  ],
  [/bill|utilit/, { icon: CategoryIcon.Bills, color: CategoryColor.Yellow }],
  [/rent|house|home/, { icon: CategoryIcon.Rent, color: CategoryColor.Purple }],
  [
    /health|hospital|medic|pharm|doctor/,
    { icon: CategoryIcon.Health, color: CategoryColor.Red },
  ],
  [
    /school|educat|fees|book|tuition/,
    { icon: CategoryIcon.Education, color: CategoryColor.Blue },
  ],
  [
    /subscri|netflix|spotify|showmax/,
    { icon: CategoryIcon.Subscription, color: CategoryColor.Purple },
  ],
  [
    /movie|entertain|\bfun\b|game|party/,
    { icon: CategoryIcon.Entertainment, color: CategoryColor.Purple },
  ],
  [
    /travel|flight|hotel|trip/,
    { icon: CategoryIcon.Travel, color: CategoryColor.Teal },
  ],
  [/gift|donat/, { icon: CategoryIcon.Gift, color: CategoryColor.Pink }],
  [
    /family|kids|child|parent/,
    { icon: CategoryIcon.Family, color: CategoryColor.Green },
  ],
  [
    /church|tithe|offering|mosque/,
    { icon: CategoryIcon.Church, color: CategoryColor.Purple },
  ],
  [
    /salon|barber|hair|beauty|personal/,
    { icon: CategoryIcon.PersonalCare, color: CategoryColor.Pink },
  ],
  [
    /gym|fitness|sport/,
    { icon: CategoryIcon.Fitness, color: CategoryColor.Lime },
  ],
  [
    /\bpets?\b|\bdog|\bcat\b/,
    { icon: CategoryIcon.Pets, color: CategoryColor.Orange },
  ],
  [
    /repair|mainten|fix/,
    { icon: CategoryIcon.Repairs, color: CategoryColor.Grey },
  ],
  [/saving|susu/, { icon: CategoryIcon.Savings, color: CategoryColor.Green }],
  [/loan|debt/, { icon: CategoryIcon.Loan, color: CategoryColor.Red }],
  [
    /salary|wage|pay\b|payment/,
    { icon: CategoryIcon.Salary, color: CategoryColor.Green },
  ],
  [
    /business|sales|shop income|client/,
    { icon: CategoryIcon.Business, color: CategoryColor.Teal },
  ],
  [
    /invest|dividend|interest|stock/,
    { icon: CategoryIcon.Investment, color: CategoryColor.Lime },
  ],
  [/refund|cashback/, { icon: CategoryIcon.Refund, color: CategoryColor.Blue }],
];

/** A sensible icon and colour for a category known only by its title. */
export function guessLook(title: string): CategoryLook {
  const t = title.toLowerCase();
  for (const [pattern, look] of GUESSES) {
    if (pattern.test(t)) return look;
  }
  return { icon: CategoryIcon.Other, color: CategoryColor.Grey };
}

export function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function cleanTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}
