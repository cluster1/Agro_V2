import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ImportsService, dayOf, minute } from './imports.service';
import { ImportsController } from './imports.controller';
import { detectFormat, parseCsv, parseUpload, MAX_FILE_BYTES, MAX_ROWS } from './import-parser';
import { normalizeDateTime, normalizeDay, toNumber, toSymptoms } from './import-rules';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

const csv = (s: string) => Buffer.from(s, 'utf8');

describe('rules', () => {
  it('normalises dates in ISO and Indonesian formats', () => {
    expect(normalizeDay('2026-12-23')).toBe('2026-12-23');
    expect(normalizeDay('23/12/2026')).toBe('2026-12-23');
    expect(normalizeDay('3-9-2026')).toBe('2026-09-03');
    expect(normalizeDay('2026/12/23')).toBeNull();
    expect(normalizeDay('besok')).toBeNull();
    expect(normalizeDay('2026-02-31')).toBeNull();
    expect(normalizeDay('31/02/2026')).toBeNull();
    expect(normalizeDay('29/02/2028')).toBe('2028-02-29');
  });

  it('normalises date-times, defaulting the time to 08:00', () => {
    expect(normalizeDateTime('2026-09-29')).toBe('2026-09-29T08:00');
    expect(normalizeDateTime('2026-09-29 7:30')).toBe('2026-09-29T07:30');
    expect(normalizeDateTime('29/09/2026 14:05:59')).toBe('2026-09-29T14:05');
    expect(normalizeDateTime('2026-09-29T09:00')).toBe('2026-09-29T09:00');
    expect(normalizeDateTime('kemarin pagi')).toBeNull();
  });

  it('reads numbers with a decimal comma or point, nothing looser', () => {
    expect(toNumber('5,5')).toBe(5.5);
    expect(toNumber('5.5')).toBe(5.5);
    expect(toNumber('-3')).toBe(-3);
    for (const bad of ['1.000,5', '1,000.5', '5 kg', '', 'abc', '1e3', '0x10']) expect(toNumber(bad)).toBeNaN();
  });

  it('splits symptoms on , ; | and upper-cases them', () => {
    expect(toSymptoms('n_kuning; kerdil|P_GELAP')).toEqual(['N_KUNING', 'KERDIL', 'P_GELAP']);
    expect(toSymptoms('')).toEqual([]);
  });

  it('formats DB date values like request values', () => {
    expect(minute(new Date(2026, 8, 29, 8, 0))).toBe('2026-09-29 08:00');
    expect(minute('2026-09-29T08:00')).toBe('2026-09-29 08:00');
    expect(minute('2026-09-29 08:00:00')).toBe('2026-09-29 08:00');
    expect(dayOf(new Date(2026, 11, 3))).toBe('2026-12-03');
    expect(dayOf('2026-12-03')).toBe('2026-12-03');
  });
});

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, embedded newlines and CRLF', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",z\r\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['line1\nline2', 'z']]);
  });

  it('detects the semicolon delimiter and strips the BOM', () => {
    expect(parseCsv('﻿a;b\n1,5;2\n')).toEqual([['a', 'b'], ['1,5', '2']]);
  });

  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,b\n"oops,1\n')).toThrow(BadRequestException);
  });
});

describe('parseUpload', () => {
  it('reads a CSV with normalised headers and 1-based line numbers, skipping blank lines', async () => {
    const out = await parseUpload(csv('Plant, HV Date ,hv_weight\n\nA,2026-12-01,100\n\n,,\nB,2026-12-02,200\n'));
    expect(out.headers).toEqual(['plant', 'hv_date', 'hv_weight']);
    expect(out.rows.map((r) => [r.line, r.cells.plant])).toEqual([[3, 'A'], [6, 'B']]);
  });

  it('rejects empty files, header-only files, duplicate headers, oversize and too many rows', async () => {
    await expect(parseUpload(Buffer.alloc(0))).rejects.toBeInstanceOf(BadRequestException);
    await expect(parseUpload(csv('a,b\n'))).rejects.toThrow(/tidak berisi baris data/);
    await expect(parseUpload(csv('a,a\n1,2\n'))).rejects.toThrow(/ganda/);
    await expect(parseUpload(Buffer.alloc(MAX_FILE_BYTES + 1, 97))).rejects.toThrow(/2 MB/);
    const many = 'a\n' + Array.from({ length: MAX_ROWS + 1 }, () => '1').join('\n');
    await expect(parseUpload(csv(many))).rejects.toThrow(/Maksimal/);
  });

  it('sniffs the format from bytes: binary junk and renamed files are refused', async () => {
    expect(detectFormat(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0]))).toBe('xlsx');
    expect(() => detectFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]))).toThrow(BadRequestException);
    await expect(parseUpload(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).rejects.toThrow(/XLSX/);
  });

  it('reads XLSX: dates, numbers, rich text and formula results (never the formula)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRow(['plant', 'hv_date', 'hv_weight', 'hv_desc']);
    ws.addRow(['A', new Date(Date.UTC(2026, 11, 1)), 6000, { formula: 'A1&"x"', result: 'dari rumus' }]);
    ws.addRow(['B', '2026-12-02', 5500.5, { richText: [{ text: 'rich ' }, { text: 'text' }] }]);
    const out = await parseUpload(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(out.rows[0].cells).toEqual({ plant: 'A', hv_date: '2026-12-01 00:00:00', hv_weight: '6000', hv_desc: 'dari rumus' });
    expect(out.rows[1].cells).toMatchObject({ hv_weight: '5500.5', hv_desc: 'rich text' });
  });
});

// ------------------------------------------------------------------ service

const plants: any[] = [
  { plant_id: 'P1', tenant_id: 'T1', plant_name: 'Padi Petak A' },
  { plant_id: 'P2', tenant_id: 'T1', plant_name: 'Padi Petak B' },
  { plant_id: 'P3', tenant_id: 'T1', plant_name: 'Kembar' },
  { plant_id: 'P4', tenant_id: 'T1', plant_name: 'kembar' },
];

function setup(existing: { harvests?: any[]; observations?: any[] } = {}) {
  const harvests = {
    create: jest.fn(async (_t, _u, dto, opts) => {
      if (dto.hv_weight === 666) throw new BadRequestException('Kadar air harus 5-40%');
      if (dto.hv_weight === 777) throw new Error('db down');
      return { ...dto, opts };
    }),
    findAll: jest.fn(async (_t, f) => (existing.harvests ?? []).filter((h) => h.plant_id === f.plantId)),
  };
  const observations = {
    create: jest.fn(async (_t, _u, dto, opts) => ({ ...dto, opts })),
    findAll: jest.fn(async (_t, f) => (existing.observations ?? []).filter((o) => o.plant_id === f.plantId)),
  };
  const repo = { find: jest.fn(async ({ where }) => plants.filter((p) => p.tenant_id === where.tenant_id)) };
  return { service: new ImportsService(repo as any, harvests as any, observations as any), harvests, observations, repo };
}

const H = 'plant,hv_date,hv_weight,hv_moisture\n';

describe('ImportsService.run (harvests)', () => {
  it('previews without saving and commits with source IMPORT', async () => {
    const { service, harvests } = setup();
    const file = csv(H + 'Padi Petak A,23/12/2026,"6000",25\nP2,2026-12-24,5500,14\n');

    const preview = await service.run('harvests', 'T1', 'u1', file, false);
    expect(preview).toMatchObject({ committed: false, total: 2, valid: 2, invalid: 0, saved: 0 });
    expect(harvests.create.mock.calls.every((c) => c[3].dryRun === true && c[3].source === 'IMPORT')).toBe(true);
    expect(preview.rows[0].data).toMatchObject({ plant_id: 'P1', hv_date: '2026-12-23', hv_weight: 6000, hv_moisture: 25 });

    harvests.create.mockClear();
    const commit = await service.run('harvests', 'T1', 'u1', file, true);
    expect(commit).toMatchObject({ committed: true, valid: 2, saved: 2 });
    expect(harvests.create.mock.calls.every((c) => c[3].dryRun === false && c[3].source === 'IMPORT')).toBe(true);
  });

  it('accepts plant_id as the header alias', async () => {
    const { service } = setup();
    const out = await service.run('harvests', 'T1', 'u1', csv('plant_id,hv_date,hv_weight,hv_moisture\nP1,2026-12-23,100,20\n'), false);
    expect(out.valid).toBe(1);
  });

  it('fails the whole file for missing required columns and lists unknown ones', async () => {
    const { service } = setup();
    await expect(service.run('harvests', 'T1', 'u1', csv('plant,hv_date\nA,2026-12-23\n'), false)).rejects.toThrow(/hv_weight, hv_moisture/);
    const out = await service.run('harvests', 'T1', 'u1', csv(H.trim() + ',warna\nP1,2026-12-23,100,20,biru\n'), false);
    expect(out.ignored_columns).toEqual(['warna']);
    expect(out.valid).toBe(1);
  });

  it('reports every bad row with its line and keeps the good ones (BR: invalid rows are not saved)', async () => {
    const { service, harvests } = setup();
    const file = csv(
      H +
        'P1,2026-12-01,100,25\n' + // line 2 ok
        'NOPE,2026-12-02,100,25\n' + // unknown plant
        'P1,2026-02-31,100,25\n' + // impossible date
        'P1,2026-12-04,abc,25\n' + // not a number
        ',2026-12-05,100,25\n' + // missing plant
        'P1,2026-12-06,666,25\n' + // service rule
        'P1,2026-12-07,777,25\n' + // unexpected error
        'P2,2026-12-08,100,\n', // missing moisture
    );
    const out = await service.run('harvests', 'T1', 'u1', file, true);
    expect(out).toMatchObject({ total: 8, valid: 1, invalid: 7, saved: 1 });
    expect(out.rows.filter((r) => !r.ok).map((r) => r.line)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    const msg = (line: number) => out.rows.find((r) => r.line === line)!.errors.join(' | ');
    expect(msg(3)).toMatch(/NOPE.*tidak ditemukan/);
    expect(msg(4)).toMatch(/hv_date/);
    expect(msg(5)).toMatch(/hv_weight.*bukan angka/);
    expect(msg(6)).toMatch(/plant: wajib diisi/);
    expect(msg(7)).toBe('Kadar air harus 5-40%');
    expect(msg(8)).toBe('Gagal memproses baris ini'); // internals are not leaked
    expect(msg(9)).toMatch(/hv_moisture: wajib diisi/);
    expect(harvests.create).toHaveBeenCalledTimes(3); // only rows that passed conversion reach the service
    expect(out.rows.find((r) => r.line === 3)!.cells).toBeDefined(); // original cells for the error download
    expect(out.rows.find((r) => r.line === 2)!.cells).toBeUndefined();
  });

  it('resolves plants by name case-insensitively, and refuses ambiguous names', async () => {
    const { service } = setup();
    const out = await service.run('harvests', 'T1', 'u1', csv(H + 'padi petak b,2026-12-01,100,20\nKembar,2026-12-02,100,20\n'), false);
    expect(out.rows[0]).toMatchObject({ ok: true, data: { plant_id: 'P2' } });
    expect(out.rows[1].errors[0]).toMatch(/dipakai 2 tanaman/);
  });

  it('only sees the caller’s tenant plants', async () => {
    const { service, repo } = setup();
    const out = await service.run('harvests', 'T2', 'u1', csv(H + 'P1,2026-12-01,100,20\n'), false);
    expect(repo.find).toHaveBeenCalledWith({ where: { tenant_id: 'T2' } });
    expect(out.rows[0].errors[0]).toMatch(/tidak ditemukan/);
  });

  it('rejects duplicates inside the file and rows that already exist in the database', async () => {
    const { service } = setup({ harvests: [{ plant_id: 'P2', hv_date: '2026-12-08', hv_weight: 100 }] });
    const out = await service.run(
      'harvests',
      'T1',
      'u1',
      csv(H + 'P1,2026-12-01,100,20\nP1,2026-12-01,100,22\nP1,2026-12-01,101,20\nP2,2026-12-08,100,20\n'),
      true,
    );
    expect(out.rows.map((r) => r.ok)).toEqual([true, false, true, false]);
    expect(out.rows[1].errors[0]).toMatch(/ganda/);
    expect(out.rows[3].errors[0]).toMatch(/sudah ada/);
    expect(out.saved).toBe(2);
  });

  it('runs class-validator rules from the DTO as well', async () => {
    const { service } = setup();
    const out = await service.run('harvests', 'T1', 'u1', csv(H + 'P1,2026-12-01,0,20\n'), false);
    expect(out.rows[0].errors.join()).toMatch(/hv_weight/);
  });
});

describe('ImportsService.run (observations)', () => {
  const O = 'plant,obs_date,obs_height,obs_tiller,obs_bwd,obs_symptom,obs_sample_n\n';

  it('converts types, defaults the time and sends symptoms as an array', async () => {
    const { service, observations } = setup();
    const out = await service.run('observations', 'T1', 'u1', csv(O + 'P1,2026-09-29,32,8,"3,5","n_kuning;kerdil",20\n'), true);
    expect(out).toMatchObject({ valid: 1, saved: 1 });
    expect(observations.create.mock.calls[0][2]).toMatchObject({
      plant_id: 'P1',
      obs_date: '2026-09-29T08:00',
      obs_height: 32,
      obs_tiller: 8,
      obs_bwd: 3.5,
      obs_symptom: ['N_KUNING', 'KERDIL'],
      obs_sample_n: 20,
    });
    expect(observations.create.mock.calls[0][3]).toEqual({ source: 'IMPORT', dryRun: false });
  });

  it('rejects an invalid symptom code through the DTO rules and a fractional sample size', async () => {
    const { service } = setup();
    const out = await service.run('observations', 'T1', 'u1', csv(O + 'P1,2026-09-29,32,8,,BUSUK,20\nP1,2026-09-30,32,8,,,20.5\n'), false);
    expect(out.rows[0].errors.join()).toMatch(/obs_symptom/);
    expect(out.rows[1].errors.join()).toMatch(/obs_sample_n.*bulat/);
  });

  it('treats the same plant and minute as a duplicate (database rows come back as Date)', async () => {
    const { service } = setup({ observations: [{ plant_id: 'P1', obs_date: new Date(2026, 8, 29, 8, 0) }] });
    const out = await service.run('observations', 'T1', 'u1', csv(O + 'P1,2026-09-29 08:00,32,8,,,\nP1,2026-09-29 09:00,32,8,,,\n'), false);
    expect(out.rows.map((r) => r.ok)).toEqual([false, true]);
  });
});

describe('ImportsService templates and types', () => {
  it('rejects unknown import types', () => {
    const { service } = setup();
    expect(() => service.assertType('users')).toThrow(BadRequestException);
    expect(service.assertType('harvests')).toBe('harvests');
  });

  it('builds a CSV template whose header round-trips through the parser', async () => {
    const { service } = setup();
    for (const type of ['harvests', 'observations'] as const) {
      const file = await service.template(type, 'csv');
      expect(file.filename).toBe(`template-${type}.csv`);
      const parsed = await parseUpload(file.buffer);
      expect(parsed.headers[0]).toBe('plant');
      expect(parsed.rows).toHaveLength(1); // the example row
    }
  });

  it('builds an XLSX template with a Data and a Petunjuk sheet', async () => {
    const { service } = setup();
    const file = await service.template('harvests', 'xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Data', 'Petunjuk']);
    expect(wb.getWorksheet('Data')!.getRow(1).getCell(1).value).toBe('plant');
    const out = await parseUpload(file.buffer);
    expect(out.headers).toContain('hv_weight');
  });
});

describe('ImportsController roles', () => {
  it.each(['template', 'preview', 'commit'] as const)('%s: admin, tenant_admin, agronom (no operator)', (n) => {
    expect([...Reflect.getMetadata(ROLES_KEY, ImportsController.prototype[n])].sort()).toEqual(['admin', 'agronom', 'tenant_admin']);
  });

  it('is unused import guard for NotFoundException type', () => {
    expect(new NotFoundException()).toBeInstanceOf(Error);
  });
});
