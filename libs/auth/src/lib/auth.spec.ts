import { Permission, Role } from '@nx-temp/data';
import { canAccessOrganization, hasPermission } from '../index';

describe('auth library', () => {
  it('grants inherited permissions correctly', () => {
    expect(hasPermission(Role.Owner, Permission.TaskDelete)).toBe(true);
    expect(hasPermission(Role.Admin, Permission.AuditRead)).toBe(true);
    expect(hasPermission(Role.Viewer, Permission.TaskUpdate)).toBe(false);
  });

  it('enforces organization scope by role', () => {
    expect(canAccessOrganization(Role.Owner, 'child-org', 'parent-org', ['parent-org', 'child-org'])).toBe(true);
    expect(canAccessOrganization(Role.Admin, 'child-org', 'parent-org', ['parent-org', 'child-org'])).toBe(false);
  });
});
