/** "+01:00" style offsets only; anything else falls back to UTC. */
export function utcOffset(value: unknown): string {
  return typeof value === 'string' && /^[+-](0\d|1[0-4]):[0-5]\d$/.test(value)
    ? value
    : '+00:00';
}

/** 1–24 months, 12 when not given. */
export function monthCount(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 24) : 12;
}

/** The first moment of the month [months] - 1 before [now]'s, in the zone
 * [offset] (e.g. "+01:00"). */
export function startOfMonths(now: Date, months: number, offset: string): Date {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  const shift = sign * (h * 60 + m) * 60_000;
  const local = new Date(now.getTime() + shift);
  const start = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth() - (months - 1),
    1,
  );
  return new Date(start - shift);
}
