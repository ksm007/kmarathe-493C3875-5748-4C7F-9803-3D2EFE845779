import { CurrentUser } from '@nx-temp/data';

export interface AuthenticatedUser extends CurrentUser {
  accessibleOrganizationIds?: string[];
}
