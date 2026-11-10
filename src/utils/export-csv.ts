import { FileContentResponse } from 'src/dtos/common/file-content-response';
import { Transaction } from 'src/schemas/transaction.schema';

/** One CSV cell: quoted when needed, and a leading = + - @ (which
 * spreadsheet apps would run as a formula) made plain text. */
export function csvCell(value: unknown): string {
  if (value == null) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]): string {
  // The BOM makes Excel read the file as UTF-8 (GH₵, names with accents).
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const EXPORT_HEADERS = [
  'Date',
  'Type',
  'Category',
  'Description',
  'Amount',
  'Currency',
  'Account',
  'Receipt',
  'ID',
];

/** A transaction as an export row; [accountName] names its account. */
export function exportRow(
  t: Transaction,
  accountName: (id: string) => string,
): unknown[] {
  const d = t.createdAt ? new Date(t.createdAt) : null;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date =
    d && !isNaN(d.getTime())
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      : '';
  return [
    date,
    t.type ?? '',
    t.category ?? '',
    t.description ?? '',
    Number(t.amount ?? 0).toFixed(2),
    t.currency ?? '',
    accountName(t.account),
    t.invoiceUrl ?? '',
    t.id ?? '',
  ];
}

export function exportFileName(ext: string, now = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `transactions_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.${ext}`;
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  accountName: (id: string) => string,
): FileContentResponse {
  const csv = toCsv([
    EXPORT_HEADERS,
    ...transactions.map((t) => exportRow(t, accountName)),
  ]);
  return new FileContentResponse(
    Buffer.from(csv, 'utf8').toString('base64'),
    exportFileName('csv'),
    'text/csv',
  );
}
