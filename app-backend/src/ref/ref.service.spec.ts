import { NotFoundException } from '@nestjs/common';
import { REF_RESOURCES, RefService } from './ref.service';
import { PlantPhase } from './entities/plant-phase.entity';
import { ActivityType } from './entities/activity-type.entity';

function setup() {
  const find = jest.fn().mockResolvedValue([]);
  const findOne = jest.fn().mockResolvedValue({ ok: true });
  const getRepository = jest.fn().mockReturnValue({ find, findOne });
  const service = new RefService({ manager: { getRepository } } as any);
  return { service, find, findOne, getRepository };
}

describe('RefService', () => {
  it('exposes the nine reference resources from the FSD', () => {
    expect(Object.keys(REF_RESOURCES).sort()).toEqual(
      [
        'activity-types',
        'materials',
        'phase-params',
        'phases',
        'plant-types',
        'telemetry',
        'units',
        'variety-phases',
        'varieties',
      ].sort(),
    );
  });

  it('lists a resource with its default order and no filter', async () => {
    const { service, find, getRepository } = setup();
    await service.findAll('phases', {});
    expect(getRepository).toHaveBeenCalledWith(PlantPhase);
    expect(find).toHaveBeenCalledWith({ where: {}, order: { ptype_id: 'ASC', phase_seq: 'ASC' } });
  });

  it('applies declared filters and maps param names to columns', async () => {
    const { service, find, getRepository } = setup();
    await service.findAll('activity-types', { ptype_id: 'PT-PADI', category: 'PEMUPUKAN' });
    expect(getRepository).toHaveBeenCalledWith(ActivityType);
    expect(find.mock.calls[0][0].where).toEqual({ ptype_id: 'PT-PADI', actype_category: 'PEMUPUKAN' });
  });

  it('ignores filters a resource does not declare (cannot widen into other columns)', async () => {
    const { service, find } = setup();
    await service.findAll('materials', { ptype_id: 'PT-PADI', var_id: 'X', category: 'PUPUK' });
    expect(find.mock.calls[0][0].where).toEqual({ mat_category: 'PUPUK' });
  });

  it.each(['nope', '__proto__', 'constructor', 'toString'])('404 for unknown resource %p', async (name) => {
    const { service } = setup();
    await expect(service.findAll(name, {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne(name, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne looks up by the resource key and 404s when missing', async () => {
    const { service, findOne } = setup();
    await service.findOne('varieties', 'VAR-PD-IR64');
    expect(findOne).toHaveBeenCalledWith({ where: { var_id: 'VAR-PD-IR64' } });

    findOne.mockResolvedValue(null);
    await expect(service.findOne('varieties', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
