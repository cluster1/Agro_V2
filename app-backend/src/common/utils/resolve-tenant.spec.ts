import { BadRequestException } from '@nestjs/common';
import { requestedTenant } from './resolve-tenant';

const admin = { tenant_id: 'T0', user_role: 'admin', user_level: 0 };
const tenantAdmin = { tenant_id: 'T1', user_role: 'tenant_admin', user_level: 1 };

describe('requestedTenant', () => {
  it('returns the JWT tenant for non-admins, whatever the header says', () => {
    expect(requestedTenant(tenantAdmin, { 'x-tenant-id': 'T2' })).toBe('T1');
    expect(requestedTenant(tenantAdmin, {})).toBe('T1');
    expect(requestedTenant(tenantAdmin, { 'x-tenant-id': "'; DROP TABLE x" })).toBe('T1');
  });

  it('returns the header for a global admin, undefined when absent or empty', () => {
    expect(requestedTenant(admin, { 'x-tenant-id': 'TENANT2' })).toBe('TENANT2');
    expect(requestedTenant(admin, {})).toBeUndefined();
    expect(requestedTenant(admin, { 'x-tenant-id': '' })).toBeUndefined();
    expect(requestedTenant(admin, undefined)).toBeUndefined();
  });

  it('uses the first value when the header is repeated', () => {
    expect(requestedTenant(admin, { 'x-tenant-id': ['T2', 'T3'] })).toBe('T2');
  });

  it.each(['T 2', 'T2;x', '../T2', 'x'.repeat(33), 'T2%00'])('rejects malformed id %p for an admin', (v) => {
    expect(() => requestedTenant(admin, { 'x-tenant-id': v })).toThrow(BadRequestException);
  });

  it('has no tenant for an unauthenticated caller', () => {
    expect(requestedTenant(undefined, { 'x-tenant-id': 'T2' })).toBeUndefined();
  });
});
