import { randomUUID } from 'crypto';
import * as otpGenerator from 'otp-generator';
import * as phoneNumberParser from 'libphonenumber-js';
import * as bcrypt from 'bcrypt';
import { TransactionFilterPeriod } from 'src/enums';

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
