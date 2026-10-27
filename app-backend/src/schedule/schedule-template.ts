import { v4 as uuidv4 } from 'uuid';
import { addDays } from '../plant/plant-rules';
import { Schedule, SCHEDULE_STATUS } from './entities/schedule.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';

export const TEMPLATE_ACTIVITIES = {
  BASAL: 'ACT-PD-PUPUK-DASAR',
  TOPDRESS_1: 'ACT-PD-PUPUK-S1',
  TOPDRESS_2: 'ACT-PD-PUPUK-S2',
  BWD: 'ACT-PD-BWD',
  DRAIN: 'ACT-PD-DRAIN',
  HARVEST: 'ACT-PD-PANEN',
} as const;

const DEFAULT_MATURITY_HSS = 115;
const TOPDRESS_1_HST = 14;
const BWD_FIRST_HST = 14;
const BWD_LAST_HST = 62;
const REMIND_HOURS = 24;

interface TemplatePlant {
  plant_id: string;
  tenant_id: string;
  site_id: string;
  cluster_id: string;
  plant_sow_date: string;
  plant_date: string;
}

interface TemplateInput {
  plant: TemplatePlant;
  variety: Pick<PlantVariety, 'var_maturity'>;
  phases: PlantPhase[];
  varietyPhases: VarietyPhase[];
  activityTypes: ActivityType[];
  userId: string;
  now: Date;
}

/**
 * Standard rice schedule (F-BDY-01): basal fertiliser HST 0, top-dress I HST 14, top-dress II at
 * the start of primordia, weekly BWD HST 14-62, drying at early yellow ripening, harvest at the
 * variety's maturity (HSS = days after sowing). Items whose activity type is missing are skipped.
 */
export function buildTemplateSchedules(input: TemplateInput): Partial<Schedule>[] {
  const { plant, variety, phases, varietyPhases, activityTypes, userId, now } = input;
  const types = new Map(activityTypes.map((t) => [t.actype_id, t]));

  // Phase start in HST: the variety's own figure when it has one, else the generic phase range.
  const startOf = (code: string): { phase?: PlantPhase; age?: number } => {
    const phase = phases.find((p) => p.phase_code === code);
    if (!phase) return {};
    const vp = varietyPhases.find((v) => v.phase_id === phase.phase_id && v.vp_start_age != null);
    return { phase, age: vp?.vp_start_age ?? phase.phase_start_age ?? undefined };
  };

  const phaseAt = (hst: number): string | undefined => {
    const ordered = [...phases].sort((a, b) => a.phase_seq - b.phase_seq);
    return ordered.find((p) => hst >= (p.phase_start_age ?? 0) && (p.phase_end_age == null || hst < p.phase_end_age))
      ?.phase_id;
  };

  const rows: Partial<Schedule>[] = [];
  const add = (actypeId: string, day: string, hst: number, extra: Partial<Schedule> = {}) => {
    const type = types.get(actypeId);
    if (!type) return;
    rows.push({
      sched_id: uuidv4().replace(/-/g, ''),
      tenant_id: plant.tenant_id,
      site_id: plant.site_id,
      cluster_id: plant.cluster_id,
      plant_id: plant.plant_id,
      actype_id: actypeId,
      phase_id: phaseAt(hst),
      user_id: userId,
      sched_title: type.actype_name,
      sched_desc: `HST ${hst}`,
      sched_start_date: `${day} 00:00:00`,
      sched_end_date: `${day} 23:59:59`,
      sched_repeat: 'NONE',
      unit_id: type.unit_id ?? undefined,
      sched_remind: REMIND_HOURS,
      sched_source: 'TEMPLATE',
      sched_sts: SCHEDULE_STATUS.PLANNED,
      sched_created: now,
      sched_update: now,
      ...extra,
    });
  };

  const at = (hst: number) => addDays(plant.plant_date, hst);

  add(TEMPLATE_ACTIVITIES.BASAL, at(0), 0);
  add(TEMPLATE_ACTIVITIES.TOPDRESS_1, at(TOPDRESS_1_HST), TOPDRESS_1_HST);

  const primordia = startOf('PRIMORDIA');
  if (primordia.age != null) add(TEMPLATE_ACTIVITIES.TOPDRESS_2, at(primordia.age), primordia.age);

  // One recurring parent; the daily job (Tahap 2) materialises its instances 30 days ahead.
  add(TEMPLATE_ACTIVITIES.BWD, at(BWD_FIRST_HST), BWD_FIRST_HST, {
    sched_repeat: 'WEEKLY',
    sched_interval: 1,
    sched_repeat_until: at(BWD_LAST_HST),
    sched_desc: `HST ${BWD_FIRST_HST}-${BWD_LAST_HST}, mingguan`,
  });

  const yellow = startOf('KUNING');
  if (yellow.age != null) add(TEMPLATE_ACTIVITIES.DRAIN, at(yellow.age), yellow.age);

  const maturity = variety.var_maturity ?? DEFAULT_MATURITY_HSS;
  const harvestDay = addDays(plant.plant_sow_date, maturity);
  const harvestHst = Math.round((Date.parse(`${harvestDay}T00:00:00Z`) - Date.parse(`${plant.plant_date}T00:00:00Z`)) / 86_400_000);
  add(TEMPLATE_ACTIVITIES.HARVEST, harvestDay, harvestHst);

  return rows;
}
