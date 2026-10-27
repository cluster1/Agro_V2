import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Site } from '../site/entities/site.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { Device } from '../device/entities/device.entity';
import { Media } from '../media/entities/media.entity';
import { ClusterService } from '../cluster/cluster.service';
import { DeviceService } from '../device/device.service';
import { MediaService } from '../media/media.service';
import { TenantRepo } from '../test-utils/fakes';

/**
 * Two tenants (T1, T2) share one in-memory "database". Every service must stay
 * inside the caller's tenant. `scope`/`tenantId` = the caller's tenant, taken
 * from the JWT by @TenantScope; undefined = global admin.
 */
function world() {
  const registry = new Map<any, TenantRepo<any>>();
  const add = <T extends Record<string, any>>(entity: any, key: string, seed: T[]) => {
    const repo = new TenantRepo<T>(key as any, seed, registry);
    registry.set(entity, repo);
    return repo;
  };

  const sites = add(Site, 'site_id', [
    { site_id: 'S1', tenant_id: 'T1' },
    { site_id: 'S2', tenant_id: 'T2' },
  ]);
  const clusters = add(Cluster, 'cluster_id', [
    { cluster_id: 'C1', tenant_id: 'T1', site_id: 'S1', cluster_name: 'one' },
    { cluster_id: 'C2', tenant_id: 'T2', site_id: 'S2', cluster_name: 'two' },
  ]);
  const devices = add(Device, 'dev_id', [
    { dev_id: 'D1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1', dev_name: 'one' },
    { dev_id: 'D2', tenant_id: 'T2', site_id: 'S2', cluster_id: 'C2', dev_name: 'two' },
  ]);
  const media = add(Media, 'media_id', [
    { media_id: 'M1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1' },
    { media_id: 'M2', tenant_id: 'T2', site_id: 'S2', cluster_id: 'C2' },
  ]);

  return {
    sites,
    clusters,
    devices,
    media,
    cluster: new ClusterService(clusters as any),
    device: new DeviceService(devices as any),
    mediaSvc: new MediaService(media as any),
  };
}

const ids = (repo: TenantRepo<any>, key: string) => repo.rows.map((r) => r[key]).sort();

describe('tenant isolation: ClusterService', () => {
  it('reads own cluster, not another tenant’s', async () => {
    const w = world();
    await expect(w.cluster.findOne('C1', undefined, 'T1')).resolves.toMatchObject({ cluster_id: 'C1' });
    await expect(w.cluster.findOne('C2', undefined, 'T1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sees every tenant when scope is undefined (global admin)', async () => {
    const w = world();
    await expect(w.cluster.findOne('C2', undefined, undefined)).resolves.toMatchObject({ cluster_id: 'C2' });
  });

  it('cannot update another tenant’s cluster, and leaves it untouched', async () => {
    const w = world();
    await expect(w.cluster.update('C2', { cluster_name: 'pwned' } as any, 'T1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(w.clusters.rows.find((r) => r.cluster_id === 'C2').cluster_name).toBe('two');
  });

  it('cannot delete another tenant’s cluster', async () => {
    const w = world();
    await expect(w.cluster.remove('C2', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    expect(ids(w.clusters, 'cluster_id')).toEqual(['C1', 'C2']);
  });

  it('can delete its own cluster', async () => {
    const w = world();
    await w.cluster.remove('C1', 'T1');
    expect(ids(w.clusters, 'cluster_id')).toEqual(['C2']);
  });

  it('listing a foreign site’s clusters yields nothing', async () => {
    const w = world();
    await expect(w.cluster.findAll('S2', 'T1')).resolves.toEqual([]);
  });

  it('cannot create a cluster under another tenant’s site', async () => {
    const w = world();
    await expect(w.cluster.create('T1', { site_id: 'S2', cluster_name: 'x' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(w.clusters.rows).toHaveLength(2);
  });

  it('cannot move an own cluster under another tenant’s site', async () => {
    const w = world();
    await expect(w.cluster.update('C1', { site_id: 'S2' } as any, 'T1')).rejects.toBeInstanceOf(NotFoundException);
    expect(w.clusters.rows.find((r) => r.cluster_id === 'C1').site_id).toBe('S1');
  });

  it('create stamps the caller’s tenant, ignoring a tenant_id smuggled in the DTO', async () => {
    const w = world();
    const created = await w.cluster.create('T1', { site_id: 'S1', cluster_name: 'x', tenant_id: 'T2' } as any);
    expect(created.tenant_id).toBe('T1');
  });
});

describe('tenant isolation: DeviceService', () => {
  it('reads own device, not another tenant’s', async () => {
    const w = world();
    await expect(w.device.findOne('D1', undefined, 'T1')).resolves.toMatchObject({ dev_id: 'D1' });
    await expect(w.device.findOne('D2', undefined, 'T1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only the caller’s devices', async () => {
    const w = world();
    const res = await w.device.findAll(undefined, 'T1');
    expect(res.map((d) => d.dev_id)).toEqual(['D1']);
  });

  it('cannot update or delete another tenant’s device', async () => {
    const w = world();
    await expect(w.device.update('D2', { dev_name: 'pwned' } as any, 'T1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(w.device.remove('D2', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    expect(w.devices.rows.find((r) => r.dev_id === 'D2')).toMatchObject({ dev_name: 'two' });
  });

  it('cannot attach a new device to another tenant’s cluster or site', async () => {
    const w = world();
    await expect(
      w.device.create('T1', 'u1', { site_id: 'S1', cluster_id: 'C2', dev_name: 'x' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      w.device.create('T1', 'u1', { site_id: 'S2', cluster_id: 'C1', dev_name: 'x' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(w.devices.rows).toHaveLength(2);
  });

  it('rejects a cluster that does not belong to the given site (same tenant)', async () => {
    const w = world();
    w.sites.rows.push({ site_id: 'S1b', tenant_id: 'T1' });
    await expect(
      w.device.create('T1', 'u1', { site_id: 'S1b', cluster_id: 'C1', dev_name: 'x' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot re-home an own device onto another tenant’s cluster', async () => {
    const w = world();
    await expect(w.device.update('D1', { cluster_id: 'C2' } as any, 'T1')).rejects.toBeInstanceOf(NotFoundException);
    expect(w.devices.rows.find((r) => r.dev_id === 'D1').cluster_id).toBe('C1');
  });

  it('create stamps tenant and user from the server, not the DTO', async () => {
    const w = world();
    const created = await w.device.create('T1', 'real-user', {
      site_id: 'S1',
      cluster_id: 'C1',
      dev_name: 'x',
      tenant_id: 'T2',
      user_id: 'someone-else',
    } as any);
    expect(created.tenant_id).toBe('T1');
    expect(created.user_id).toBe('real-user');
  });
});

describe('tenant isolation: MediaService', () => {
  it('reads own media, not another tenant’s', async () => {
    const w = world();
    await expect(w.mediaSvc.findOne('T1', 'M1')).resolves.toMatchObject({ media_id: 'M1' });
    await expect(w.mediaSvc.findOne('T1', 'M2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cannot delete another tenant’s media', async () => {
    const w = world();
    await expect(w.mediaSvc.remove('T1', 'M2')).rejects.toBeInstanceOf(NotFoundException);
    expect(ids(w.media, 'media_id')).toEqual(['M1', 'M2']);
  });

  it('listing by a foreign site or cluster yields nothing', async () => {
    const w = world();
    await expect(w.mediaSvc.findBySite('T1', 'S2')).resolves.toEqual([]);
    await expect(w.mediaSvc.findByCluster('T1', 'C2')).resolves.toEqual([]);
    await expect(w.mediaSvc.findAll('T1', 'S2')).resolves.toEqual([]);
  });

  it('cannot attach new media to another tenant’s site or cluster', async () => {
    const w = world();
    await expect(w.mediaSvc.create('T1', 'u1', { site_id: 'S2' } as any, '/uploads/x.png')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      w.mediaSvc.create('T1', 'u1', { site_id: 'S1', cluster_id: 'C2' } as any, '/uploads/x.png'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(w.media.rows).toHaveLength(2);
  });

  it('create stamps tenant and user from the server, not the DTO', async () => {
    const w = world();
    const created = await w.mediaSvc.create(
      'T1',
      'real-user',
      { site_id: 'S1', tenant_id: 'T2', user_id: 'other', media_id: 'M1' } as any,
      '/uploads/x.png',
    );
    expect(created.tenant_id).toBe('T1');
    expect(created.user_id).toBe('real-user');
    expect(created.media_id).not.toBe('M1');
  });
});
