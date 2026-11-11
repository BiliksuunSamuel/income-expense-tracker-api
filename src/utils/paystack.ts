import { createHmac, timingSafeEqual } from 'crypto';
import configuration from 'src/configuration';
import { PaymentStatus } from 'src/enums';

/// The parts of `GET /transaction/verify/:reference` the API reads.
export interface PaystackTransaction {
  id?: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  gateway_response?: string | null;
  channel?: string | null;
  fees?: number | null;
  paid_at?: string | null;
  authorization?: {
    last4?: string | null;
    brand?: string | null;
    bank?: string | null;
    mobile_money_number?: string | null;
  } | null;
}

/// Paystack's record of a finished charge, kept on the invoice.
export interface PaymentGatewayDetails {
  transactionId: string | null;
  channel: string | null;
  currency: string | null;
  fees: number | null;
  paidAt: Date | null;
}

/// Where a charge stands at Paystack: still pending, or finished with how it
/// was paid or why it failed.
export interface ChargeCheck {
  status: PaymentStatus.Processing | PaymentStatus.Completed | PaymentStatus.Failed;
  method?: string;
  failureReason?: string;
  gateway?: PaymentGatewayDetails;
}

/// What Paystack is asked for, for [cedis] (PaystackAmountMultiplier). At
/// least 1: Paystack refuses a zero charge.
export function paystackAmount(cedis: number): number {
  return Math.max(
    1,
    Math.round(cedis * configuration().paystackConfig.amountMultiplier),
  );
}

/// Paystack's answer as a charge check, [amount] being what Paystack was
/// asked for. Anything unfinished (abandoned, ongoing, pending, queued) stays
/// processing: the user may still pay.
export function toChargeCheck(
  tx: PaystackTransaction,
  amount: number,
  currency = configuration().paystackConfig.currency,
): ChargeCheck {
  if (tx.status === 'success') {
    if (tx.amount !== amount || tx.currency !== currency) {
      return {
        status: PaymentStatus.Failed,
        failureReason: "The amount paid didn't match. Contact support.",
        gateway: gatewayDetails(tx),
      };
    }
    return {
      status: PaymentStatus.Completed,
      method: paymentMethod(tx),
      gateway: gatewayDetails(tx),
    };
  }
  if (tx.status === 'failed' || tx.status === 'reversed') {
    return {
      status: PaymentStatus.Failed,
      failureReason: tx.gateway_response || 'The payment did not go through',
      gateway: gatewayDetails(tx),
    };
  }
  return { status: PaymentStatus.Processing };
}

/// Whether [signature] (the `x-paystack-signature` header) is Paystack's
/// HMAC-SHA512 of the exact [raw] body, keyed with the secret key.
export function isValidPaystackSignature(
  raw: Buffer,
  signature: string,
  key = configuration().paystackConfig.secretKey,
): boolean {
  if (!key) return false;
  const expected = Buffer.from(
    createHmac('sha512', key).update(raw).digest('hex'),
    'utf8',
  );
  const given = Buffer.from(signature, 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function gatewayDetails(tx: PaystackTransaction): PaymentGatewayDetails {
  return {
    transactionId: tx.id == null ? null : String(tx.id),
    channel: tx.channel ?? null,
    currency: tx.currency ?? null,
    fees: tx.fees ?? null,
    paidAt: tx.paid_at ? new Date(tx.paid_at) : null,
  };
}

/// "MoMo · MTN •••4567" or "Visa ••••4081".
export function paymentMethod(tx: PaystackTransaction): string | undefined {
  const a = tx.authorization;
  if (tx.channel === 'mobile_money') {
    const last = a?.mobile_money_number?.slice(-4);
    return ['MoMo ·', a?.bank, last && `•••${last}`].filter(Boolean).join(' ');
  }
  if (tx.channel === 'card' && a?.last4) {
    const brand = a.brand
      ? a.brand[0].toUpperCase() + a.brand.slice(1)
      : 'Card';
    return `${brand} ••••${a.last4}`;
  }
  return tx.channel ?? undefined;
}

/// [s] safe inside HTML text, attributes and a JS string.
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"'\\/]/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '\\': '&#92;',
        '/': '&#47;',
      })[c],
  );
}
