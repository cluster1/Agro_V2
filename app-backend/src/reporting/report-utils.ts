export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Plain strings for text so a spreadsheet never interprets a name as a formula. */
export const safeText = (v: unknown) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v);

export const MAX_RANGE_DAYS = 366;
