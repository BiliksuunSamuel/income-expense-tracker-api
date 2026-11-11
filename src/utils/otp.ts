import { createHmac, timingSafeEqual } from 'crypto';
import constants from 'src/constants';

/// One-time codes are never stored: only this keyed hash is. The key is derived
/// from the server secret, so a copy of the database alone can't be used to
/// recover a code by brute-forcing the 10^6 possibilities.
export function hashOtp(code: string): string {
  return createHmac('sha256', `${constants().secret}:otp`)
    .update(code.trim())
    .digest('hex');
}

/// Constant-time check of a submitted [code] against a stored [hash].
export function otpMatches(code: string, hash?: string | null): boolean {
  if (!hash || typeof code !== 'string') return false;
  const a = Buffer.from(hashOtp(code), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
