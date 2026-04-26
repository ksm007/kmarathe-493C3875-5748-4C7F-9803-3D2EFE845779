import { Role } from '@nx-temp/data';

export function canAccessOrganization(
  role: Role,
  organizationId: string,
  userOrganizationId: string,
  accessibleOrganizationIds: string[]
): boolean {
  if (role === Role.Owner) {
    return accessibleOrganizationIds.includes(organizationId);
  }

  return organizationId === userOrganizationId;
}
