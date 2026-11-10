/** The phrase the app sends to confirm deleting an account. */
export const DELETE_CONFIRMATION = 'DELETE';

/** User fields never handed out in a data download. */
export const PRIVATE_USER_FIELDS = [
  '_id',
  '__v',
  'password',
  'verificationCode',
  'otpExpiryTime',
  'tokenId',
  'fcmToken',
  'googleAccessToken',
  'resetPassword',
  'authenticated',
  'isLoggedIn',
] as const;

export function withoutPrivateFields<T extends object>(user: T): Partial<T> {
  const copy: Record<string, unknown> = {
    ...(user as Record<string, unknown>),
  };
  for (const key of PRIVATE_USER_FIELDS) delete copy[key];
  return copy as Partial<T>;
}

/** Drops Mongo's own fields from stored documents. */
export function clean<T extends object>(docs: T[]): T[] {
  return docs.map((d) => {
    const { _id, __v, ...rest } = d as Record<string, unknown>;
    return rest as T;
  });
}

/** Cloudinary's public id ("IncomeExpenseInvoices/abc") from a delivery
 * URL like `…/upload/v123/IncomeExpenseInvoices/abc.jpg`. */
export function cloudinaryPublicId(url: string): string | null {
  const match =
    /\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?([^?#]+?)(?:\.[a-z0-9]+)?(?:[?#].*)?$/i.exec(
      url ?? '',
    );
  return match ? match[1] : null;
}
