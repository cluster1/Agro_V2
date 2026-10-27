import { BadRequestException } from '@nestjs/common';
import { SEASON_RE, addDays, areaWarning, daysBetween, parseDay, parsePolygon, phaseForAge, polygonAreaHa } from './plant-rules';

// ~1 ha square near the equator: 0.0000898 deg ~ 10 m... 100 m x 100 m
const DEG_100M = 100 / 111_319.49;
const square = (side = 1) => ({
  type: 'Polygon',
  coordinates: [
    [
      [107, -6],
      [107 + DEG_100M * side, -6],
      [107 + DEG_100M * side, -6 - DEG_100M * side],
      [107, -6 - DEG_100M * side],
      [107, -6],
    ],
  ],
});

describe('season format', () => {
  it.each(['MT1-2026', 'MT2-2026', 'MT3-1999'])('accepts %s', (v) => expect(SEASON_RE.test(v)).toBe(true));
  it.each(['MT0-2026', 'MT4-2026', 'mt2-2026', 'MT2-26', 'MT2_2026', 'MT2-2026x', ''])('rejects %p', (v) =>
    expect(SEASON_RE.test(v)).toBe(false),
  );
});

describe('date helpers', () => {
  it('parses valid days and rejects impossible or malformed ones', () => {
    expect(parseDay('2026-09-15', 'x')).toBe(Date.parse('2026-09-15T00:00:00Z'));
    for (const bad of ['2026-02-31', '2026-13-01', '15-09-2026', '2026-9-5', 'abc', '']) {
      expect(() => parseDay(bad, 'Tanggal')).toThrow(BadRequestException);
    }
  });

  it('adds and diffs days across month and year ends', () => {
    expect(addDays('2026-09-15', 14)).toBe('2026-09-29');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-09-15', '2026-12-23')).toBe(99);
    expect(daysBetween('2026-09-15', '2026-09-10')).toBe(-5);
  });
});

describe('phaseForAge', () => {
  const phases = [
    { phase_id: 'P1', phase_seq: 1, phase_start_age: -21, phase_end_age: 0 },
    { phase_id: 'P2', phase_seq: 2, phase_start_age: 0, phase_end_age: 10 },
    { phase_id: 'P3', phase_seq: 3, phase_start_age: 10, phase_end_age: 22 },
    { phase_id: 'P4', phase_seq: 4, phase_start_age: 22, phase_end_age: null },
  ];

  it.each([
    [-30, 'P1'],
    [-1, 'P1'],
    [0, 'P2'],
    [9, 'P2'],
    [10, 'P3'],
    [21, 'P3'],
    [22, 'P4'],
    [500, 'P4'],
  ])('HST %i -> %s', (age, id) => expect(phaseForAge(phases, age)?.phase_id).toBe(id));

  it('returns undefined without phases', () => expect(phaseForAge([], 3)).toBeUndefined());
});

describe('geometry', () => {
  it('computes about 1 ha for a 100 m square', () => {
    expect(polygonAreaHa(parsePolygon(square()))).toBeCloseTo(1, 1);
  });

  it('accepts a JSON string as well as an object', () => {
    expect(parsePolygon(JSON.stringify(square()))).toHaveLength(5);
  });

  it.each([
    ['not json', 'nope'],
    ['wrong type', { type: 'Point', coordinates: [1, 2] }],
    ['too few points', { type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] }],
    ['open ring', { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }],
    ['non-numeric', { type: 'Polygon', coordinates: [[['a', 0], [1, 0], [1, 1], ['a', 0]]] }],
    ['out of range', { type: 'Polygon', coordinates: [[[181, 0], [1, 0], [1, 1], [181, 0]]] }],
    ['null', null],
  ])('rejects %s', (_n, geom) => {
    expect(() => parsePolygon(geom)).toThrow(BadRequestException);
  });

  it('warns only when drawn and declared area differ by more than 10%', () => {
    expect(areaWarning(1, square())).toBeUndefined();
    expect(areaWarning(1.09, square())).toBeUndefined();
    expect(areaWarning(1.2, square())).toMatch(/berbeda/);
    expect(areaWarning(0.5, square())).toMatch(/berbeda/);
  });

  it('gives no warning without geometry or declared area', () => {
    expect(areaWarning(1, undefined)).toBeUndefined();
    expect(areaWarning(undefined, square())).toBeUndefined();
    expect(areaWarning(0, square())).toBeUndefined();
  });
});
