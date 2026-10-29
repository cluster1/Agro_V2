import { TwinService } from './twin.service';
import { Plant } from '../plant/entities/plant.entity';
import { Site } from '../site/entities/site.entity';
import { Device } from '../device/entities/device.entity';
import { Sensor } from '../sensor/entities/sensor.entity';
import { makeManager } from '../test-utils/fake-manager';

function setup(tables: Map<unknown, any[]>) {
  const manager = makeManager(tables);
  const plants = { find: manager.getRepository(Plant).find, manager };
  return new TwinService(plants as any, {} as any);
}

const tables = () =>
  new Map<unknown, any[]>([
    [
      Plant,
      [
        { plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', plant_sts: 1 },
        { plant_id: 'P2', tenant_id: 'T1', site_id: 'S1', plant_sts: 1 },
        { plant_id: 'P3', tenant_id: 'T2', site_id: 'S9', plant_sts: 1 },
        { plant_id: 'P4', tenant_id: 'T1', site_id: 'S2', plant_sts: 0 },
      ],
    ],
    [
      Site,
      [
        { site_id: 'S1', tenant_id: 'T1', site_name: 'Sawah A', site_lat: '-6.9', site_lon: '107.6' },
        { site_id: 'S2', tenant_id: 'T1', site_name: 'Tidak aktif', site_lat: -7, site_lon: 108 },
        { site_id: 'S9', tenant_id: 'T2', site_name: 'Tenant lain', site_lat: 1, site_lon: 2 },
      ],
    ],
    [
      Device,
      [
        { dev_id: 'D1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1', dev_name: 'Station Kit', dev_lat: -6.91, dev_lon: 107.61 },
        { dev_id: 'D2', tenant_id: 'T1', site_id: 'S1', cluster_id: null, dev_name: 'Tanpa koordinat', dev_lat: null, dev_lon: null },
        { dev_id: 'D9', tenant_id: 'T2', site_id: 'S9', cluster_id: 'C9', dev_name: 'Tenant lain', dev_lat: 1, dev_lon: 2 },
      ],
    ],
    [
      Sensor,
      [
        { sens_id: 'SN1', dev_id: 'D1', tenant_id: 'T1', sens_name: 'Kamera', sens_type: 'cctv', sens_lat: -6.912, sens_lon: 107.612 },
        { sens_id: 'SN2', dev_id: 'D2', tenant_id: 'T1', sens_name: 'Suhu', sens_type: null, sens_lat: null, sens_lon: null },
        { sens_id: 'SN9', dev_id: 'D9', tenant_id: 'T2', sens_name: 'Tenant lain', sens_type: null, sens_lat: 1, sens_lon: 2 },
      ],
    ],
  ]);

describe('TwinService.mapData', () => {
  it('returns only the tenant sites of active plants, with numeric coordinates', async () => {
    const data = await setup(tables()).mapData(undefined, 'T1');
    expect(data.sites).toEqual([{ site_id: 'S1', name: 'Sawah A', lat: -6.9, lon: 107.6 }]);
  });

  it('keeps devices and sensors without coordinates as null so the client can fall back to the site', async () => {
    const data = await setup(tables()).mapData(undefined, 'T1');
    expect(data.devices.map((d) => [d.dev_id, d.lat, d.lon])).toEqual([
      ['D1', -6.91, 107.61],
      ['D2', null, null],
    ]);
    expect(data.sensors.map((s) => [s.sens_id, s.lat, s.lon])).toEqual([
      ['SN1', -6.912, 107.612],
      ['SN2', null, null],
    ]);
  });

  it('returns the device and sensor details shown when an object is clicked in the 3D model', async () => {
    const t = tables();
    Object.assign(t.get(Device)![0], { dev_location: 'Pematang utara', dev_number_id: 'SK-01', dev_img: 'https://example.test/kit.png', dev_sts: 1 });
    t.get(Sensor)![1].sens_location = 'Dekat saluran';
    const data = await setup(t).mapData(undefined, 'T1');
    expect(data.devices[0]).toMatchObject({ location: 'Pematang utara', number_id: 'SK-01', image: 'https://example.test/kit.png', status: 1 });
    expect(data.devices[1]).toMatchObject({ location: null, number_id: null, image: null, status: null });
    expect(data.sensors[1]).toMatchObject({ location: 'Dekat saluran' });
    expect(data.sensors[0]).toMatchObject({ location: null });
  });

  it('never leaks another tenant', async () => {
    const data = await setup(tables()).mapData(undefined, 'T1');
    const ids = [...data.sites.map((s) => s.site_id), ...data.devices.map((d) => d.dev_id), ...data.sensors.map((s) => s.sens_id)];
    expect(ids.some((i) => ['S9', 'D9', 'SN9'].includes(i))).toBe(false);
  });

  it('global admin (no scope) sees every tenant', async () => {
    const data = await setup(tables()).mapData(undefined, undefined);
    expect(data.sites.map((s) => s.site_id).sort()).toEqual(['S1', 'S9']);
  });

  it('filters by siteId', async () => {
    const data = await setup(tables()).mapData('S9', undefined);
    expect(data.sites.map((s) => s.site_id)).toEqual(['S9']);
    expect(data.devices.map((d) => d.dev_id)).toEqual(['D9']);
  });

  it('is empty when no plant is active', async () => {
    const t = tables();
    t.set(Plant, []);
    expect(await setup(t).mapData(undefined, 'T1')).toEqual({ sites: [], devices: [], sensors: [] });
  });
});
