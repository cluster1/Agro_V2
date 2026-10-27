import { nutrientInput, parseAmount, requiresMaterial } from './activity-rules';

const urea = { mat_n: 46, mat_p2o5: null, mat_k2o: null };
const npk = { mat_n: 15, mat_p2o5: 15, mat_k2o: 15 };

describe('nutrientInput', () => {
  it('BR-11: 150 kg urea on 2 ha is 34.5 kg N/ha', () => {
    expect(nutrientInput(150, urea, 2)).toEqual({ n_kg_ha: 34.5, p2o5_kg_ha: 0, k2o_kg_ha: 0 });
  });

  it('computes all three nutrients for a compound fertiliser (200 kg NPK 15-15-15 on 2 ha = 15 each)', () => {
    expect(nutrientInput(200, npk, 2)).toEqual({ n_kg_ha: 15, p2o5_kg_ha: 15, k2o_kg_ha: 15 });
  });

  it('rounds to two decimals', () => {
    expect(nutrientInput(100, { mat_n: 46 }, 3)!.n_kg_ha).toBe(15.33);
  });

  it.each([
    ['no material', 150, null, 2],
    ['zero amount', 0, urea, 2],
    ['negative amount', -5, urea, 2],
    ['missing amount', undefined, urea, 2],
    ['zero area', 150, urea, 0],
    ['missing area', 150, urea, null],
  ])('is null for %s', (_n, amount, mat, area) => {
    expect(nutrientInput(amount as any, mat as any, area as any)).toBeNull();
  });
});

describe('parseAmount', () => {
  it.each([
    ['150', 150],
    ['150,5', 150.5],
    ['0.5', 0.5],
    ['0', 0],
  ])('%s -> %s', (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(['', null, undefined, 'abc', '12 kg', 'Infinity'])('%p -> undefined', (v) =>
    expect(parseAmount(v as any)).toBeUndefined(),
  );
});

describe('requiresMaterial', () => {
  it.each(['PEMUPUKAN', 'PROTEKSI'])('%s needs a material', (c) => expect(requiresMaterial(c)).toBe(true));
  it.each(['PERSIAPAN', 'TANAM', 'OBSERVASI', 'IRIGASI', null, undefined, ''])('%p does not', (c) =>
    expect(requiresMaterial(c as any)).toBe(false),
  );
});
