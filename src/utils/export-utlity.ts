import { FileContentResponse } from 'src/dtos/common/file-content-response';
import { Transaction } from 'src/schemas/transaction.schema';
import ExcelJS from 'exceljs';

// Export transaction to Excel
export async function ExportTransactionToExcel(
  transactions: Transaction[],
): Promise<FileContentResponse> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transactions', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  // Define columns (order, headers, keys, widths)
  sheet.columns = [
    { header: 'ID', key: 'id', width: 24 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Type', key: 'Type', width: 14 },
    { header: 'Description', key: 'description', width: 40 },
  ];

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF3F8' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  // Add rows
  const toExcelDate = (d: Date | string | undefined) => {
    if (!d) return null;
    const dt = typeof d === 'string' ? new Date(d) : d;
    return isNaN(dt.getTime()) ? d : dt; // ExcelJS can take a Date directly
  };

  transactions.forEach((t) => {
    sheet.addRow({
      id: t.id ?? '',
      date: toExcelDate(t.createdAt),
      amount: t.amount ?? 0,
      currency: t.currency ?? '',
      category: t.category ?? '',
      type: t.type ?? 'N/A',
      description: t.description ?? '',
    });
  });

  // Format columns
  const dateCol = sheet.getColumn('date');
  dateCol.numFmt = 'yyyy-mm-dd hh:mm';
  const amountCol = sheet.getColumn('amount');
  amountCol.numFmt = '#,##0.00';

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  // Borders & zebra stripes for data rows
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF2F2F2' } },
        left: { style: 'thin', color: { argb: 'FFF2F2F2' } },
        bottom: { style: 'thin', color: { argb: 'FFF2F2F2' } },
        right: { style: 'thin', color: { argb: 'FFF2F2F2' } },
      };
    });
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FBFD' },
        };
      });
    }
  }

  // Generate file
  const buffer = await workbook.xlsx.writeBuffer();
  const contentBase64 = Buffer.from(buffer).toString('base64');

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const fileName = `transactions_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;

  const contentType =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return new FileContentResponse(contentBase64, fileName, contentType);
}
