import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 2000;

export type RawRow = Record<string, string>;

export interface ParsedFile {
  headers: string[];
  /** 1-based spreadsheet row numbers (header = 1) paired with cell text by header */
  rows: { line: number; cells: RawRow }[];
}

const normHeader = (h: unknown): string =>
  String(h ?? '')
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

/** Sniffs the real format from the bytes, never from the client filename or MIME. */
export function detectFormat(buf: Buffer): 'xlsx' | 'csv' {
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'xlsx';
  const head = buf.subarray(0, 4096);
  if (head.includes(0)) throw new BadRequestException('Berkas harus CSV atau XLSX');
  return 'csv';
}

/** RFC 4180-style CSV: quoted fields, doubled quotes, CRLF/LF, ',' or ';' delimiter (Excel in Indonesia writes ';'). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (inQuotes) throw new BadRequestException('CSV tidak valid: tanda kutip tidak ditutup');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue); // formula: use its value, never the formula
    if ('richText' in v) return (v.richText as { text: string }[]).map((t) => t.text).join('');
    if ('text' in v) return String(v.text ?? ''); // hyperlink
    return '';
  }
  return String(value);
}

function build(table: string[][]): ParsedFile {
  const nonEmpty = table.findIndex((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty === -1) throw new BadRequestException('Berkas kosong');
  const headers = table[nonEmpty].map(normHeader);
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) {
    throw new BadRequestException('Nama kolom ganda pada baris judul');
  }

  const rows: ParsedFile['rows'] = [];
  for (let i = nonEmpty + 1; i < table.length; i++) {
    const cells: RawRow = {};
    headers.forEach((h, idx) => {
      if (h) cells[h] = (table[i][idx] ?? '').trim();
    });
    if (Object.values(cells).every((v) => v === '')) continue; // blank line
    rows.push({ line: i + 1, cells });
  }
  if (rows.length === 0) throw new BadRequestException('Berkas tidak berisi baris data');
  if (rows.length > MAX_ROWS) throw new BadRequestException(`Maksimal ${MAX_ROWS} baris per impor`);
  return { headers: headers.filter(Boolean), rows };
}

export async function parseUpload(buf: Buffer): Promise<ParsedFile> {
  if (buf.length === 0) throw new BadRequestException('Berkas kosong');
  if (buf.length > MAX_FILE_BYTES) throw new BadRequestException('Ukuran berkas maksimal 2 MB');

  if (detectFormat(buf) === 'csv') return build(parseCsv(buf.toString('utf8')));

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buf as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('Berkas XLSX tidak dapat dibaca');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('Berkas XLSX tidak berisi lembar kerja');
  if (sheet.rowCount > MAX_ROWS + 50) throw new BadRequestException(`Maksimal ${MAX_ROWS} baris per impor`);

  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let c = 1; c <= Math.max(row.cellCount, row.actualCellCount); c++) cells.push(cellText(row.getCell(c).value));
    table[rowNumber - 1] = cells;
  });
  for (let i = 0; i < table.length; i++) table[i] = table[i] ?? []; // keep line numbers aligned with the sheet
  return build(table);
}
