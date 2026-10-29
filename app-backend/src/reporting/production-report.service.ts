import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Harvest } from '../harvest/entities/harvest.entity';
import { Plant } from '../plant/entities/plant.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { Site } from '../site/entities/site.entity';
import { round } from '../model/model-config';
import { dayOf } from '../plant/plant-rules';
import { scoped } from '../common/utils/scope';
import { renderTablePdf } from './pdf-table';
import { safeText } from './report-utils';

export interface ProductionFilter {
  siteId?: string;
  season?: string;
  varId?: string;
}

export interface ProductionRow {
  plant_id: string;
  plant_name: string | null;
  site_id: string | null;
  site_name: string | null;
  season: string | null;
  var_id: string | null;
  variety: string | null;
  harvests: number;
  last_date: string | null;
  area_ha: number;
  /** gabah kering panen, kg */
  gkp_kg: number;
  /** gabah kering giling, kg */
  gkg_kg: number;
  /** weighted: total GKG / total area of the harvests that have a GKG weight */
  yield_t_ha: number | null;
}

export interface ProductionSummary {
  plots: number;
  area_ha: number;
  gkp_kg: number;
  gkg_kg: number;
  yield_t_ha: number | null;
}

interface Acc {
  harvests: number;
  last: string | null;
  area: number;
  gkp: number;
  gkg: number;
  yieldArea: number;
}

const yieldOf = (gkg: number, area: number): number | null => (gkg > 0 && area > 0 ? round(gkg / 1000 / area, 2) : null);

@Injectable()
export class ProductionReportService {
  constructor(
    @InjectRepository(Harvest)
    private readonly harvests: Repository<Harvest>,
  ) {}

  private get manager() {
    return this.harvests.manager;
  }

  /** F-RPT-01 "Produksi": harvest per plot per season. */
  async report(scope: string | undefined, filter: ProductionFilter = {}): Promise<{ rows: ProductionRow[]; summary: ProductionSummary }> {
    const where: Record<string, unknown> = {};
    if (filter.siteId) where.site_id = filter.siteId;
    const harvests = (await this.harvests.find({ where: scoped(where, scope) })) as Harvest[];
    if (!harvests.length) return { rows: [], summary: this.summarise([]) };
    const plantIds = [...new Set(harvests.map((h) => h.plant_id).filter(Boolean))];
    const [plants, varieties, sites] = await Promise.all([
      this.manager.getRepository(Plant).find({ where: { plant_id: In(plantIds) } }),
      this.manager.getRepository(PlantVariety).find({}),
      this.manager.getRepository(Site).find({}),
    ]);
    const plantBy = new Map((plants as Plant[]).map((p) => [p.plant_id, p]));
    const varietyName = new Map((varieties as PlantVariety[]).map((v) => [v.var_id, v.var_name]));
    const siteName = new Map((sites as Site[]).map((s) => [s.site_id, s.site_name]));

    const groups = new Map<string, { plant: Plant | undefined; season: string | null; acc: Acc }>();
    for (const h of harvests) {
      const plant = plantBy.get(h.plant_id);
      const season = h.hv_season ?? plant?.plant_season ?? null;
      if (filter.season && season !== filter.season) continue;
      if (filter.varId && plant?.var_id !== filter.varId) continue;
      const key = `${h.plant_id}|${season ?? ''}`;
      const group = groups.get(key) ?? { plant, season, acc: { harvests: 0, last: null, area: 0, gkp: 0, gkg: 0, yieldArea: 0 } };
      const a = group.acc;
      a.harvests += 1;
      a.area += h.hv_area ?? 0;
      a.gkp += h.hv_weight ?? 0;
      if (h.hv_weight_dry) {
        a.gkg += h.hv_weight_dry;
        a.yieldArea += h.hv_area ?? 0;
      }
      const day = h.hv_date ? dayOf(h.hv_date) : null;
      if (day && (!a.last || day > a.last)) a.last = day;
      groups.set(key, group);
    }

    const entries = [...groups.entries()].map(([key, { plant, season, acc }]) => {
      const row: ProductionRow = {
        plant_id: key.split('|')[0],
        plant_name: plant?.plant_name ?? null,
        site_id: plant?.site_id ?? null,
        site_name: plant?.site_id ? siteName.get(plant.site_id) ?? plant.site_id : null,
        season,
        var_id: plant?.var_id ?? null,
        variety: plant?.var_id ? varietyName.get(plant.var_id) ?? plant.var_id : null,
        harvests: acc.harvests,
        last_date: acc.last,
        area_ha: round(acc.area, 2),
        gkp_kg: round(acc.gkp, 1),
        gkg_kg: round(acc.gkg, 1),
        yield_t_ha: yieldOf(acc.gkg, acc.yieldArea),
      };
      return { row, yieldArea: acc.yieldArea };
    });
    entries.sort((a, b) => String(b.row.season).localeCompare(String(a.row.season)) || String(a.row.plant_name).localeCompare(String(b.row.plant_name)));
    return { rows: entries.map((e) => e.row), summary: this.summarise(entries) };
  }

  /** The yield denominator counts only harvests that were weighed, matching the per-row yield. */
  private summarise(entries: { row: ProductionRow; yieldArea: number }[]): ProductionSummary {
    const rows = entries.map((e) => e.row);
    const gkg = rows.reduce((s, r) => s + r.gkg_kg, 0);
    const yieldArea = entries.reduce((s, e) => s + e.yieldArea, 0);
    return {
      plots: new Set(rows.map((r) => r.plant_id)).size,
      area_ha: round(rows.reduce((s, r) => s + r.area_ha, 0), 2),
      gkp_kg: round(rows.reduce((s, r) => s + r.gkp_kg, 0), 1),
      gkg_kg: round(gkg, 1),
      yield_t_ha: yieldOf(gkg, yieldArea),
    };
  }

  async toXlsx(rows: ProductionRow[], summary: ProductionSummary): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Produksi');
    ws.columns = [
      { header: 'Petak', key: 'plant_name', width: 28 },
      { header: 'Site', key: 'site_name', width: 24 },
      { header: 'Musim', key: 'season', width: 12 },
      { header: 'Varietas', key: 'variety', width: 22 },
      { header: 'Panen (kali)', key: 'harvests', width: 12 },
      { header: 'Panen terakhir', key: 'last_date', width: 16 },
      { header: 'Luas (ha)', key: 'area_ha', width: 12 },
      { header: 'GKP (kg)', key: 'gkp_kg', width: 14 },
      { header: 'GKG (kg)', key: 'gkg_kg', width: 14 },
      { header: 'Hasil (t/ha)', key: 'yield_t_ha', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
      ws.addRow({ ...r, plant_name: safeText(r.plant_name), site_name: safeText(r.site_name), variety: safeText(r.variety), yield_t_ha: r.yield_t_ha ?? '' });
    }
    const sum = wb.addWorksheet('Ringkasan');
    sum.addRows([
      ['Jumlah petak', summary.plots],
      ['Luas panen (ha)', summary.area_ha],
      ['GKP (kg)', summary.gkp_kg],
      ['GKG (kg)', summary.gkg_kg],
      ['Hasil rata-rata berbobot (t/ha)', summary.yield_t_ha ?? '-'],
    ]);
    sum.columns = [{ width: 36 }, { width: 14 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  toPdf(rows: ProductionRow[], summary: ProductionSummary, filter: ProductionFilter = {}): Promise<Buffer> {
    const num = (n: number | null, digits = 2) => (n === null ? '-' : n.toLocaleString('id-ID', { maximumFractionDigits: digits }));
    const applied = [filter.season && `Musim ${filter.season}`, filter.siteId && `Site ${filter.siteId}`, filter.varId && `Varietas ${filter.varId}`].filter(Boolean);
    return renderTablePdf({
      title: 'Laporan Produksi',
      subtitle: applied.length ? applied.join(' | ') : 'Semua musim dan site',
      columns: [
        { header: 'Petak', weight: 4 },
        { header: 'Site', weight: 3 },
        { header: 'Musim', weight: 1.6 },
        { header: 'Varietas', weight: 3 },
        { header: 'Luas (ha)', weight: 1.6, align: 'right' },
        { header: 'GKP (kg)', weight: 2, align: 'right' },
        { header: 'GKG (kg)', weight: 2, align: 'right' },
        { header: 'Hasil (t/ha)', weight: 1.8, align: 'right' },
      ],
      rows: rows.map((r) => [r.plant_name ?? '-', r.site_name ?? '-', r.season ?? '-', r.variety ?? '-', num(r.area_ha), num(r.gkp_kg, 1), num(r.gkg_kg, 1), num(r.yield_t_ha)]),
      totals: [['Total', `${summary.plots} petak`, '', '', num(summary.area_ha), num(summary.gkp_kg, 1), num(summary.gkg_kg, 1), num(summary.yield_t_ha)]],
    });
  }
}
