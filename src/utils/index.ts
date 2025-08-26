import { randomUUID } from 'crypto';
import * as otpGenerator from 'otp-generator';
import * as phoneNumberParser from 'libphonenumber-js';
import * as bcrypt from 'bcryptjs';
import { BillingFrequency, TransactionFilterPeriod } from 'src/enums';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Subscription } from 'src/schemas/subscription.schema';

//hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

//verify password
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

//generate id
export function generateId() {
  return randomUUID().toString().split('-').join('');
}

export function formatPhoneNumber(
  phoneNumber: string,
  countryCode: phoneNumberParser.CountryCode = 'GH',
) {
  const isValid = phoneNumberParser.isValidNumber(phoneNumber, countryCode);
  const validNumber = phoneNumberParser
    .parsePhoneNumberFromString(phoneNumber, 'GH')
    .number.slice(1);
  return {
    isValid,
    validNumber,
  };
}

export function generateOtp(length: number = 6) {
  return otpGenerator.generate(length, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
}

export function generateOtpPrefix(length: number = 4) {
  return otpGenerator.generate(length, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: true,
    digits: false,
    specialChars: false,
  });
}

export function toPaginationInfo(object: any): {
  page: number;
  pageSize: number;
} {
  const page = object?.page;
  const pageSize = object?.pageSize;
  return {
    page: !isNaN(page) ? parseInt(page) : 1,
    pageSize: !isNaN(pageSize) ? parseInt(pageSize) : 10,
  };
}

export function accountVerificationMessage(code: string): string {
  return `Acccount verification details have been requested for your account, please do not share this details with anyone.Code is ${code}`;
}

//convert file extension to base64 filetype
export function convertFileExtensionToBase64FileType(extension: string) {
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpeg':
      return 'image/jpeg';
    case 'jpg':
      return 'image/jpg';
    default:
      return 'application/pdf';
  }
}

//convert transaction filter to date range
export function convertTransactionFilterPeriodToDateTimeRange(
  period: TransactionFilterPeriod,
): { startDate: Date; endDate: Date } {
  let endDate = new Date();
  let startDate = new Date();
  switch (period) {
    case TransactionFilterPeriod.Today:
      startDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        0,
        0,
        0,
      );
      break;
    case TransactionFilterPeriod.Week:
      startDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate() - endDate.getDay(),
        0,
        0,
        0,
      );
      break;
    case TransactionFilterPeriod.Month:
      startDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        1,
        0,
        0,
        0,
      );
      break;
    case TransactionFilterPeriod.Year:
      startDate = new Date(endDate.getFullYear(), 0, 1, 0, 0, 0);
      break;
    default:
      startDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        0,
        0,
        0,
      );
  }
  return { startDate, endDate };
}

export function calculateYearlyPrice(plan: BillingPlan): BillingPlan {
  const yearlyPrice = plan.price * 12;
  const discount = (yearlyPrice * plan.yearlyDiscount) / 100;
  plan.yearlyPrice = yearlyPrice - discount;
  return plan;
}

export function getInvoiceStartDateAndEndDate(subscription: Subscription): {
  startDate: Date;
  endDate: Date;
} {
  if (subscription.billingFrequency === BillingFrequency.Monthly) {
    const startDate = new Date(subscription.startDate);
    //add 30 days to start date for monthly billing
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + 30,
      23,
      59,
      59,
    );
    return { startDate, endDate };
  }
  const startDate = new Date(subscription.startDate);
  const endDate = new Date(
    startDate.getFullYear() + 1,
    startDate.getMonth(),
    startDate.getDate() - 1,
    23,
    59,
    59,
  );
  return { startDate, endDate };
}

export function getInvoiceAmount(
  billingPlan: BillingPlan,
  frequency: BillingFrequency,
): number {
  if (frequency === BillingFrequency.Monthly) {
    return billingPlan.price;
  }
  return calculateYearlyPrice(billingPlan).yearlyPrice;
}

//generate invoice number
export function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2); // last two digits of the year
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // month in two digits
  const day = date.getDate().toString().padStart(2, '0'); // day in two digits
  const randomPart = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0'); // random four-digit number
  return `INV-${year}${month}${day}-${randomPart}`;
}
