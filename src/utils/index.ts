import { randomUUID } from 'crypto';
import * as otpGenerator from 'otp-generator';
import * as phoneNumberParser from 'libphonenumber-js';
import * as bcrypt from 'bcrypt';

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

export function generateOtp(length: number = 4) {
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

export function accountVerificationMessage(
  prefix: string,
  code: string,
): string {
  return `Acccount verification details have been requested for your account, please do not share this details with anyone. Prefix ${prefix} and Code is ${code}`;
}
