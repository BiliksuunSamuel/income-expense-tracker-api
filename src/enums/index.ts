export enum UserRole {
  Admin = 'Admin',
  User = 'User',
  SuperAdmin = 'SuperAdmin',
}

export enum UserStatus {
  Active = 'Active',
  Inactive = 'Inactive',
}

export enum CategoryType {
  Personal = 'Personal',
  General = 'General',
}

export enum TransactionRepeatFrequency {
  Daily = 'Daily',
  Weekly = 'Weekly',
  Monthly = 'Monthly',
  Yearly = 'Yearly',
}

export enum TransactionType {
  Expense = 'Expense',
  Income = 'Income',
}

export enum TransactionFilterPeriod {
  Today = 'Today',
  Week = 'Week',
  Month = 'Month',
  Year = 'Year',
}

export enum BudgetStatus {
  Active = 'Active',
  Closed = 'Closed',
}

export enum RecurringTransactionStatus {
  Active = 'Active',
  Closed = 'Closed',
}

export enum BillingPlanType {
  Regular = 'Regular',
  Premium = 'Premium',
  Pro = 'Pro',
}

export enum BillingFrequency {
  Monthly = 'Monthly',
  Yearly = 'Yearly',
}

export enum PaymentStatus {
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
  Refunded = 'Refunded',
  Processing = 'Processing',
}

export enum SubscriptionStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Cancelled = 'Cancelled',
  Expired = 'Expired',
  Closed = 'Closed',
  Pending = 'Pending',
}

export enum AccountKind {
  Cash = 'Cash',
  MobileMoney = 'MobileMoney',
  Bank = 'Bank',
  Card = 'Card',
  Other = 'Other',
}

/** Which entries a category is for. */
export enum CategoryKind {
  Expense = 'Expense',
  Income = 'Income',
}

/** The icon a category shows; the app draws each key. */
export enum CategoryIcon {
  Food = 'food',
  FastFood = 'fast_food',
  Groceries = 'groceries',
  Transport = 'transport',
  Fuel = 'fuel',
  Shopping = 'shopping',
  Clothing = 'clothing',
  Bills = 'bills',
  Electricity = 'electricity',
  Water = 'water',
  Internet = 'internet',
  Airtime = 'airtime',
  Rent = 'rent',
  Health = 'health',
  Education = 'education',
  Entertainment = 'entertainment',
  Subscription = 'subscription',
  Travel = 'travel',
  Gift = 'gift',
  Family = 'family',
  Church = 'church',
  PersonalCare = 'personal_care',
  Fitness = 'fitness',
  Pets = 'pets',
  Repairs = 'repairs',
  Savings = 'savings',
  Loan = 'loan',
  Salary = 'salary',
  Business = 'business',
  Investment = 'investment',
  Refund = 'refund',
  Other = 'other',
}

/** A category's colour; the app picks the light and dark shade. */
export enum CategoryColor {
  Purple = 'purple',
  Blue = 'blue',
  Teal = 'teal',
  Green = 'green',
  Lime = 'lime',
  Yellow = 'yellow',
  Orange = 'orange',
  Red = 'red',
  Pink = 'pink',
  Grey = 'grey',
}
