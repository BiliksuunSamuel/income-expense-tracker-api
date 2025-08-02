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

export enum BillingPlanType {
  Regular = 'Regular',
  Premium = 'Premium',
  Pro = 'Pro',
}

export enum BillingFrequency {
  Monthly = 'Monthly',
  Yearly = 'Yearly',
}
