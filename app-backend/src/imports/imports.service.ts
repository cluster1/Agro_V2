import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as ExcelJS from 'exceljs';
import { Plant } from '../plant/entities/plant.entity';
import { HarvestService } from '../harvest/harvest.service';
import { ObservationService } from '../observation/observation.service';
import { CreateHarvestDto } from '../harvest/dto/create-harvest.dto';
import { CreateObservationDto } from '../observation/dto/create-observation.dto';
import { parseUpload, RawRow } from './import-parser';
import {
  COLUMNS,
  ImportType,
  IMPORT_TYPES,
  headerKeys,
  normalizeDateTime,
  normalizeDay,
  toNumber,
  toSymptoms,
} from './import-rules';

export interface ImportRowResult {
  line: number;
  ok: boolean;
  errors: string[];
  /** echo of what would be saved (plant resolved to its id) */
  data?: Record<string, unknown>;
  /** original cells, only on failed rows so they can be fixed and re-uploaded */
  cells?: RawRow;
}

export interface ImportReport {
  type: ImportType;
  committed: boolean;
  total: number;
  valid: number;
  invalid: number;
  saved: number;
  ignored_columns: string[];
  rows: ImportRowResult[];
}

const SOURCE = 'IMPORT';

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' from a date column value (string or Date). */
export function dayOf(value: Date | string): string {
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return String(value).slice(0, 10);
}

/** 'YYYY-MM-DD HH:mm' from a datetime value: DB rows come back as Date, request values as 'YYYY-MM-DDTHH:mm'. */
export function minute(value: Date | string): string {
  if (value instanceof Date) return `${dayOf(value)} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return String(value).replace('T', ' ').slice(0, 16);
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    @InjectRepository(Plant) private readonly plants: Repository<Plant>,
    private readonly harvests: HarvestService,
    private readonly observations: ObservationService,
  ) {}

  assertType(type: string): ImportType {
    if (!IMPORT_TYPES.includes(type as ImportType)) {
      throw new BadRequestException(`Jenis impor tidak dikenal. Pilih: ${IMPORT_TYPES.join(', ')}`);
    }
    return type as ImportType;
  }

  // ------------------------------------------------------------------ template

  async template(type: ImportType, format: 'csv' | 'xlsx'): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const cols = COLUMNS[type];
    const keys = cols.map((c) => c.key);
    const example = cols.map((c) => c.example);

    if (format === 'csv') {
      const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      const body = [keys, example].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
      return {
        buffer: Buffer.from('﻿' + body, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        filename: `template-${type}.csv`,
      };
    }

    const wb = new ExcelJS.Workbook();
    const data = wb.addWorksheet('Data');
    data.addRow(keys).font = { bold: true };
    data.addRow(example);
    data.columns.forEach((c) => (c.width = 22));
    const help = wb.addWorksheet('Petunjuk');
    help.addRow(['Kolom', 'Wajib', 'Keterangan']).font = { bold: true };
    cols.forEach((c) => help.addRow([c.key, c.required ? 'Ya' : 'Tidak', c.note]));
    help.columns = [{ width: 20 }, { width: 8 }, { width: 80 }];
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `template-${type}.xlsx`,
    };
  }

  // ------------------------------------------------------------------ preview / commit

  async run(type: ImportType, tenantId: string, userId: string, file: Buffer, commit: boolean): Promise<ImportReport> {
    const parsed = await parseUpload(file);

    // `plant_id` is an accepted alias of `plant`
    const aliasPlant = parsed.headers.includes('plant_id') && !parsed.headers.includes('plant');
    const headers = parsed.headers.map((h) => (aliasPlant && h === 'plant_id' ? 'plant' : h));
    const known = new Set(headerKeys(type));
    const required = COLUMNS[type].filter((c) => c.required).map((c) => c.key);
    const missing = required.filter((k) => !headers.includes(k));
    if (missing.length) throw new BadRequestException(`Kolom wajib tidak ada: ${missing.join(', ')}`);
    const ignored = headers.filter((h) => !known.has(h));

    const plantRows = await this.plants.find({ where: { tenant_id: tenantId } });
    const byId = new Map(plantRows.map((p) => [p.plant_id, p]));
    const byName = new Map<string, Plant[]>();
    for (const p of plantRows) {
      const k = (p.plant_name ?? '').trim().toLowerCase();
      if (k) byName.set(k, [...(byName.get(k) ?? []), p]);
    }

    const seen = new Set<string>(); // duplicate keys inside this file and (once loaded) in the database
    const loaded = new Set<string>();
    const results: ImportRowResult[] = [];
    let saved = 0;

    for (const { line, cells: rawCells } of parsed.rows) {
      const cells: RawRow = { ...rawCells };
      if (aliasPlant) {
        cells.plant = cells.plant_id ?? '';
        delete cells.plant_id;
      }
      const errors: string[] = [];
      const plant = this.resolvePlant(cells.plant ?? '', byId, byName, errors);
      const dto = type === 'harvests' ? this.harvestDto(cells, plant, errors) : this.observationDto(cells, plant, errors);

      let data: Record<string, unknown> | undefined;
      if (!errors.length && plant) {
        const dtoClass = (type === 'harvests' ? CreateHarvestDto : CreateObservationDto) as new () => object;
        const problems = await validate(plainToInstance(dtoClass, dto), { whitelist: true });
        for (const p of problems) errors.push(...Object.values(p.constraints ?? {}).map((m) => `${p.property}: ${m}`));
        data = dto;
      }

      let keyId = '';
      if (!errors.length && plant) {
        const key = await this.duplicateKey(type, tenantId, plant.plant_id, dto, loaded);
        keyId = key.id;
        if (key.existing) errors.push('Data yang sama sudah ada');
        else if (seen.has(key.id)) errors.push('Baris ganda dalam berkas ini');
      }

      if (!errors.length && plant) {
        try {
          const opts = { source: SOURCE, dryRun: !commit };
          if (type === 'harvests') await this.harvests.create(tenantId, userId, dto as unknown as CreateHarvestDto, opts);
          else await this.observations.create(tenantId, userId, dto as unknown as CreateObservationDto, opts);
          seen.add(keyId);
          if (commit) saved++;
        } catch (error) {
          errors.push(this.messageOf(error));
        }
      }

      results.push(
        errors.length
          ? { line, ok: false, errors, cells: rawCells }
          : { line, ok: true, errors: [], data },
      );
    }

    const valid = results.filter((r) => r.ok).length;
    return {
      type,
      committed: commit,
      total: results.length,
      valid,
      invalid: results.length - valid,
      saved,
      ignored_columns: ignored,
      rows: results,
    };
  }

  private messageOf(error: unknown): string {
    if (error instanceof HttpException) {
      const r = error.getResponse() as { message?: string | string[] } | string;
      const m = typeof r === 'string' ? r : r?.message;
      return Array.isArray(m) ? m.join('; ') : m || error.message;
    }
    this.logger.error(`Import row failed: ${(error as Error)?.message}`, (error as Error)?.stack);
    return 'Gagal memproses baris ini';
  }

  private resolvePlant(
    value: string,
    byId: Map<string, Plant>,
    byName: Map<string, Plant[]>,
    errors: string[],
  ): Plant | undefined {
    const v = value.trim();
    if (!v) {
      errors.push('plant: wajib diisi');
      return undefined;
    }
    const direct = byId.get(v);
    if (direct) return direct;
    const named = byName.get(v.toLowerCase());
    if (!named) errors.push(`plant: '${v}' tidak ditemukan`);
    else if (named.length > 1) errors.push(`plant: nama '${v}' dipakai ${named.length} tanaman; gunakan ID tanaman`);
    else return named[0];
    return undefined;
  }

  /** Builds the typed payload for a row, collecting per-column conversion errors. */
  private convert(cells: RawRow, type: ImportType, errors: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const col of COLUMNS[type]) {
      if (col.kind === 'plant') continue;
      const raw = (cells[col.key] ?? '').trim();
      if (raw === '') {
        if (col.required) errors.push(`${col.key}: wajib diisi`);
        continue;
      }
      switch (col.kind) {
        case 'number': {
          const n = toNumber(raw);
          if (Number.isNaN(n)) errors.push(`${col.key}: '${raw}' bukan angka`);
          else out[col.key] = n;
          break;
        }
        case 'int': {
          const n = toNumber(raw);
          if (Number.isNaN(n) || !Number.isInteger(n)) errors.push(`${col.key}: '${raw}' bukan bilangan bulat`);
          else out[col.key] = n;
          break;
        }
        case 'date': {
          const d = normalizeDay(raw);
          if (!d) errors.push(`${col.key}: '${raw}' bukan tanggal (YYYY-MM-DD atau DD/MM/YYYY)`);
          else out[col.key] = d;
          break;
        }
        case 'datetime': {
          const d = normalizeDateTime(raw);
          if (!d) errors.push(`${col.key}: '${raw}' bukan tanggal/waktu (YYYY-MM-DD [HH:mm])`);
          else out[col.key] = d;
          break;
        }
        case 'symptoms':
          out[col.key] = toSymptoms(raw);
          break;
        default:
          out[col.key] = raw;
      }
    }
    return out;
  }

  private harvestDto(cells: RawRow, plant: Plant | undefined, errors: string[]): Record<string, unknown> {
    const out = this.convert(cells, 'harvests', errors);
    return plant ? { plant_id: plant.plant_id, ...out } : out;
  }

  private observationDto(cells: RawRow, plant: Plant | undefined, errors: string[]): Record<string, unknown> {
    const out = this.convert(cells, 'observations', errors);
    return plant ? { plant_id: plant.plant_id, ...out } : out;
  }

  /**
   * Natural key of a row: harvest = plant + date + GKP weight; observation = plant + exact time.
   * Existing database rows for a plant are loaded once.
   */
  private async duplicateKey(
    type: ImportType,
    tenantId: string,
    plantId: string,
    dto: Record<string, unknown>,
    loaded: Set<string>,
  ): Promise<{ id: string; existing: boolean }> {
    const id =
      type === 'harvests'
        ? `${plantId}|${dto.hv_date}|${dto.hv_weight}`
        : `${plantId}|${minute(dto.obs_date as string)}`;

    const marker = `load:${type}:${plantId}`;
    if (!loaded.has(marker)) {
      loaded.add(marker);
      if (type === 'harvests') {
        for (const h of await this.harvests.findAll(tenantId, { plantId })) {
          loaded.add(`${plantId}|${dayOf(h.hv_date)}|${h.hv_weight}`);
        }
      } else {
        for (const o of await this.observations.findAll(tenantId, { plantId })) {
          loaded.add(`${plantId}|${minute(o.obs_date)}`);
        }
      }
    }
    return { id, existing: loaded.has(id) };
  }
}
