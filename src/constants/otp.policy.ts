/// Limits on one-time sign-in codes (as Pulse). Each SMS costs money and a
/// short numeric code is guessable, so both sending and guessing are capped.
export const OtpPolicy = {
  /// How long a code is valid.
  ttlMs: 5 * 60 * 1000,
  /// Wrong guesses allowed before the code is thrown away.
  maxAttempts: 5,
  /// Minimum gap between two codes for the same account.
  resendCooldownMs: 60 * 1000,
  /// Codes per rolling window for one account.
  maxSendsPerWindow: 5,
  windowMs: 60 * 60 * 1000,
};
