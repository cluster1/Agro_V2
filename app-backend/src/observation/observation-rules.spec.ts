import { BadRequestException } from '@nestjs/common';
import { stripRejection, validateMeasurements, withRejection } from './observation-rules';

const ok = (m: any, ctx: { age: number; phaseSeq?: number } = { age: 20, phaseSeq: 3 }) => expect(() => validateMeasurements(m, ctx)).not.toThrow();
const bad = (m: any, ctx: { age: number; phaseSeq?: number } = { age: 20, phaseSeq: 3 }, msg?: RegExp) => {
  expect(() => validateMeasurements(m, ctx)).toThrow(BadRequestException);
  if (msg) expect(() => validateMeasurements(m, ctx)).toThrow(msg);
};

describe('validateMeasurements', () => {
  it('needs at least one measurement', () => {
    bad({}, undefined, /minimal satu/);
    bad({ obs_height: null, obs_symptom: '' });
  });

  describe('ranges (FSD)', () => {
    it.each([5, 32, 160])('accepts height %s', (v) => ok({ obs_height: v }));
    it.each([4.9, 0, 160.1, -1])('rejects height %s', (v) => bad({ obs_height: v }, undefined, /5-160/));

    it.each([1, 8, 60])('accepts tillers %s', (v) => ok({ obs_tiller: v }));
    it.each([0, 0.5, 61])('rejects tillers %s', (v) => bad({ obs_tiller: v }, undefined, /1-60/));

    it.each([0, 50, 100])('accepts filled %s%%', (v) => ok({ obs_filled_pct: v }, { age: 70, phaseSeq: 8 }));
    it.each([-1, 100.5])('rejects filled %s%%', (v) => bad({ obs_filled_pct: v }, { age: 70, phaseSeq: 8 }, /0-100/));

    it('rejects phase and pest percentages outside 0-100', () => {
      bad({ obs_phase_pct: 101 });
      bad({ obs_pest_name: 'Wereng', obs_pest_pct: -1 });
    });
  });

  describe('BWD', () => {
    it.each([2, 2.5, 3.5, 5])('accepts %s on HST 14-62', (v) => {
      ok({ obs_bwd: v }, { age: 14, phaseSeq: 2 });
      ok({ obs_bwd: v }, { age: 62, phaseSeq: 7 });
    });

    it.each([1.5, 5.5, 3.2, 2.25, 0])('rejects %s (range or half-step)', (v) =>
      bad({ obs_bwd: v }, { age: 30, phaseSeq: 5 }, /2-5 dengan kelipatan 0,5/),
    );

    it.each([13, 63, -3])('rejects any BWD outside HST 14-62 (HST %s)', (age) =>
      bad({ obs_bwd: 3.5 }, { age, phaseSeq: 5 }, /HST 14-62/),
    );
  });

  describe('phase dependent fields', () => {
    it('panicles only from flowering (seq >= 7)', () => {
      bad({ obs_panicle: 12 }, { age: 40, phaseSeq: 6 }, /berbunga/);
      ok({ obs_panicle: 12 }, { age: 60, phaseSeq: 7 });
    });

    it('grain and filled % only from milk (8) to full (10)', () => {
      bad({ obs_grain: 120 }, { age: 60, phaseSeq: 7 }, /masak susu/);
      bad({ obs_filled_pct: 90 }, { age: 100, phaseSeq: 11 }, /masak susu/);
      ok({ obs_grain: 120, obs_filled_pct: 90 }, { age: 70, phaseSeq: 8 });
      ok({ obs_grain: 120 }, { age: 90, phaseSeq: 10 });
    });

    it('a missing phase counts as too early for phase-gated fields', () => {
      bad({ obs_panicle: 12 }, { age: 60 });
    });
  });

  describe('symptoms and pests', () => {
    it('accepts the six known codes, comma separated', () => {
      ok({ obs_symptom: 'N_KUNING,P_GELAP,K_TEPI,KERDIL,ZN_BERCAK,S_PUCAT' });
    });

    it('rejects unknown codes and names them', () => {
      bad({ obs_symptom: 'N_KUNING,BUSUK' }, undefined, /BUSUK/);
    });

    it('pest intensity needs a pest name', () => {
      bad({ obs_pest_pct: 10 }, undefined, /Nama hama/);
      ok({ obs_pest_name: 'Wereng coklat', obs_pest_pct: 10 });
    });
  });

  it('reports every problem at once', () => {
    try {
      validateMeasurements({ obs_height: 500, obs_tiller: 0, obs_bwd: 9 }, { age: 5, phaseSeq: 2 });
      fail('should throw');
    } catch (e: any) {
      expect(e.message.split('; ').length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('rejection text', () => {
  it('prefixes the reason and keeps the original note', () => {
    expect(withRejection('Foto buram', 'Anakan aktif')).toBe('Ditolak: Foto buram | Anakan aktif');
    expect(withRejection('Foto buram', null)).toBe('Ditolak: Foto buram');
  });

  it('replaces an earlier rejection instead of stacking', () => {
    expect(withRejection('Baru', 'Ditolak: Lama | Catatan')).toBe('Ditolak: Baru | Catatan');
  });

  it('strips the rejection back to the original note', () => {
    expect(stripRejection('Ditolak: Foto buram | Anakan aktif')).toBe('Anakan aktif');
    expect(stripRejection('Ditolak: Foto buram')).toBe('');
    expect(stripRejection('Catatan biasa')).toBe('Catatan biasa');
    expect(stripRejection(null)).toBe('');
  });

  it('never exceeds the column length', () => {
    expect(withRejection('x'.repeat(200), 'y'.repeat(200)).length).toBeLessThanOrEqual(255);
  });
});
