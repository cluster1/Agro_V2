import PDFDocument = require('pdfkit');

export interface PdfColumn {
  header: string;
  /** share of the page width; shares are normalised */
  weight: number;
  align?: 'left' | 'right';
}

export interface PdfTable {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: (string | number)[][];
  /** emphasised rows after the data, e.g. totals */
  totals?: (string | number)[][];
}

const MARGIN = 36;
const ROW_PAD = 4;
const FONT = 9;

/** One landscape A4 table with a repeating header row; standard PDF fonts, so no font files are needed. */
export function renderTablePdf(table: PdfTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGIN, info: { Title: table.title } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width - MARGIN * 2;
    const total = table.columns.reduce((s, c) => s + c.weight, 0);
    const widths = table.columns.map((c) => (c.weight / total) * width);
    const bottom = () => doc.page.height - MARGIN;

    const drawRow = (cells: (string | number)[], bold: boolean, shade: boolean) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT);
      const texts = cells.map((c) => String(c ?? '-'));
      const height = Math.max(...texts.map((t, i) => doc.heightOfString(t, { width: widths[i] - ROW_PAD * 2 }))) + ROW_PAD * 2;
      if (doc.y + height > bottom()) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      if (shade) doc.save().rect(MARGIN, y, width, height).fill('#EEF2EE').restore();
      let x = MARGIN;
      texts.forEach((t, i) => {
        doc.fillColor('#111111').text(t, x + ROW_PAD, y + ROW_PAD, { width: widths[i] - ROW_PAD * 2, align: table.columns[i].align ?? 'left' });
        x += widths[i];
      });
      doc.y = y + height;
    };

    const drawHeader = () => drawRow(table.columns.map((c) => c.header), true, true);

    doc.font('Helvetica-Bold').fontSize(14).text(table.title, MARGIN, MARGIN);
    if (table.subtitle) doc.font('Helvetica').fontSize(FONT).fillColor('#555555').text(table.subtitle);
    doc.moveDown(0.6);
    drawHeader();
    table.rows.forEach((r) => drawRow(r, false, false));
    table.totals?.forEach((r) => drawRow(r, true, true));
    doc.end();
  });
}
