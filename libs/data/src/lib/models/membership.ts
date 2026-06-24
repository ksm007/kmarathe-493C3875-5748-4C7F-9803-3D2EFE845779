import { Role } from './roles';

export interface MembershipInfo {
  organizationId: string;
  organizationName: string;
  role: Role;
}
