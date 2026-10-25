import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeviceSensorService } from './device-sensor.service';
import { DeviceSensor } from './entities/device-sensor.entity';
import { Sensor } from '../sensor/entities/sensor.entity';
import { Device } from '../device/entities/device.entity';
import { TenantRepo } from '../test-utils/fakes';

function world() {
  const registry = new Map<any, TenantRepo<any>>();
  const add = (entity: any, key: string, seed: any[]) => {
    const repo = new TenantRepo<any>(key, seed, registry);
    registry.set(entity, repo);
    return repo;
  };
  const devices = add(Device, 'dev_id', [
    { dev_id: 'D1', tenant_id: 'T1', cluster_id: 'C1' },
    { dev_id: 'D2', tenant_id: 'T2', cluster_id: 'C2' },
  ]);
  add(Sensor, 'sens_id', [
    { sens_id: 'S1', dev_id: 'D1', tenant_id: 'T1' },
    { sens_id: 'S2', dev_id: 'D2', tenant_id: 'T2' },
  ]);
  const params = add(DeviceSensor, 'ds_id', [
    { ds_id: 'P1', dev_id: 'D1', sens_id: 'S1', tenant_id: 'T1', cluster_id: 'C1' },
    { ds_id: 'P2', dev_id: 'D2', sens_id: 'S2', tenant_id: 'T2', cluster_id: 'C2' },
  ]);
  return { devices, params, service: new DeviceSensorService(params as any) };
}

const dto = (extra: Record<string, any> = {}) => ({ ds_id: 'NEW', ds_name: 'temp', ...extra }) as any;

describe('DeviceSensorService', () => {
  describe('create: parameter cluster must follow its device (B7)', () => {
    it('derives the cluster from the device when the DTO omits it', async () => {
      const w = world();
      const created = await w.service.create('T1', 'S1', 'D1', dto());
      expect(created.cluster_id).toBe('C1');
    });

    it('accepts a DTO cluster that matches the device', async () => {
      const w = world();
      await expect(w.service.create('T1', 'S1', 'D1', dto({ cluster_id: 'C1' }))).resolves.toBeDefined();
    });

    it('rejects a DTO cluster that differs from the device (even another cluster of the same tenant)', async () => {
      const w = world();
      await expect(w.service.create('T1', 'S1', 'D1', dto({ cluster_id: 'C-other' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(w.params.rows).toHaveLength(2);
    });

    it('rejects another tenant’s cluster', async () => {
      const w = world();
      await expect(w.service.create('T1', 'S1', 'D1', dto({ cluster_id: 'C2' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('create: tenant isolation', () => {
    it('cannot add a parameter to another tenant’s sensor/device', async () => {
      const w = world();
      await expect(w.service.create('T1', 'S2', 'D2', dto())).rejects.toBeInstanceOf(NotFoundException);
      expect(w.params.rows).toHaveLength(2);
    });

    it('cannot pair own sensor with another tenant’s device id', async () => {
      const w = world();
      await expect(w.service.create('T1', 'S1', 'D2', dto())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('stamps tenant, device and sensor from the server, not the DTO', async () => {
      const w = world();
      const created = await w.service.create(
        'T1',
        'S1',
        'D1',
        dto({ tenant_id: 'T2', dev_id: 'D2', sens_id: 'S2', cluster_id: 'C1' }),
      );
      expect(created).toMatchObject({ tenant_id: 'T1', dev_id: 'D1', sens_id: 'S1' });
    });
  });

  describe('update: cluster follows the device', () => {
    it('rejects a differing cluster_id', async () => {
      const w = world();
      await expect(
        w.service.update('P1', 'D1', 'S1', { cluster_id: 'C-other' } as any, 'T1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cannot update another tenant’s parameter', async () => {
      const w = world();
      await expect(w.service.update('P2', 'D2', 'S2', { ds_name: 'x' } as any, 'T1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('scoped reads and deletes', () => {
    it('findOne / remove cannot reach another tenant', async () => {
      const w = world();
      await expect(w.service.findOne('P2', 'D2', 'S2', 'T1')).rejects.toBeInstanceOf(NotFoundException);
      await expect(w.service.remove('P2', 'D2', 'S2', 'T1')).rejects.toBeInstanceOf(NotFoundException);
      expect(w.params.rows).toHaveLength(2);
    });

    it('global admin (undefined scope) reaches any tenant', async () => {
      const w = world();
      await expect(w.service.findOne('P2', 'D2', 'S2', undefined)).resolves.toMatchObject({ ds_id: 'P2' });
    });

    it('findAll is confined to the scope', async () => {
      const w = world();
      await expect(w.service.findAll('S2', 'D2', 'T1')).resolves.toEqual([]);
      await expect(w.service.findAll('S1', 'D1', 'T1')).resolves.toHaveLength(1);
    });
  });
});
