import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantRepo } from '../test-utils/fakes';
import { AlertService } from './alert.service';

const seed = () => [
  { alm_id: 'A1', tenant_id: 'T1', alcode_id: 'ALARM-HIGH', alm_sts: 0 },
  { alm_id: 'A2', tenant_id: 'T2', alcode_id: 'ALARM-LOW', alm_sts: 0 },
  { alm_id: 'A3', tenant_id: 'T1', alcode_id: 'ALARM-LOW', alm_sts: 2 },
  { alm_id: 'A4', tenant_id: 'T1', alcode_id: 'ALARM-LOW', alm_sts: 1 },
];

function setup() {
  const repo = new TenantRepo<any>('alm_id', seed());
  return { repo, service: new AlertService(repo as any) };
}

describe('AlertService.acknowledge', () => {
  it('marks a new alert as resolved and records who/when/note', async () => {
    const { service, repo } = setup();
    await service.acknowledge('A1', 'T1', 'u1', { alm_sts: 2, alm_note: 'Pompa dinyalakan' });
    const row = repo.rows.find((r) => r.alm_id === 'A1');
    expect(row).toMatchObject({ alm_sts: 2, alm_ack_user: 'u1', alm_note: 'Pompa dinyalakan' });
    expect(row.alm_ack_date).toBeInstanceOf(Date);
  });

  it('marks an alert as seen without a note', async () => {
    const { service, repo } = setup();
    await service.acknowledge('A1', 'T1', 'u1', { alm_sts: 1 });
    const row = repo.rows.find((r) => r.alm_id === 'A1');
    expect(row.alm_sts).toBe(1);
    expect(row.alm_note).toBeUndefined();
  });

  it('allows seen -> resolved', async () => {
    const { service, repo } = setup();
    await service.acknowledge('A4', 'T1', 'u1', { alm_sts: 2 });
    expect(repo.rows.find((r) => r.alm_id === 'A4').alm_sts).toBe(2);
  });

  it('rejects changing an alert that is already resolved', async () => {
    const { service } = setup();
    await expect(service.acknowledge('A3', 'T1', 'u1', { alm_sts: 2 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects moving status backwards', async () => {
    const { service } = setup();
    await expect(service.acknowledge('A4', 'T1', 'u1', { alm_sts: 1 })).resolves.toBeDefined();
    // 1 -> 1 is a no-op re-acknowledge; resolved alerts can never go back
    const { service: s2, repo } = setup();
    repo.rows.find((r) => r.alm_id === 'A4').alm_sts = 2;
    await expect(s2.acknowledge('A4', 'T1', 'u1', { alm_sts: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for another tenant’s alert and leaves it untouched', async () => {
    const { service, repo } = setup();
    await expect(service.acknowledge('A2', 'T1', 'u1', { alm_sts: 2 })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.rows.find((r) => r.alm_id === 'A2').alm_sts).toBe(0);
  });

  it('a global admin (no scope) can acknowledge any tenant’s alert', async () => {
    const { service, repo } = setup();
    await service.acknowledge('A2', undefined, 'ga', { alm_sts: 1 });
    expect(repo.rows.find((r) => r.alm_id === 'A2').alm_ack_user).toBe('ga');
  });
});

describe('AlertService.findAll filters', () => {
  it('scopes by tm_alarm.tenant_id and applies status and code filters', async () => {
    const repo = { query: jest.fn().mockResolvedValue([]) };
    const service = new AlertService(repo as any);
    await service.findAll('T1', { status: 0, code: 'ALARM-HIGH', deviceId: 'D1' } as any);
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('WHERE tm_alarm.tenant_id = ?');
    expect(sql).toContain('IFNULL(tm_alarm.alm_sts, 0) = ?');
    expect(sql).toContain('tm_alarm.alcode_id = ?');
    expect(params).toEqual(['T1', 0, 'ALARM-HIGH', 'D1']);
  });

  it('does not add status/code conditions when not requested', async () => {
    const repo = { query: jest.fn().mockResolvedValue([]) };
    await new AlertService(repo as any).findAll('T1', {});
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).not.toContain('alm_sts, 0) = ?');
    expect(params).toEqual(['T1']);
  });
});
