import { Role } from '../models/roles';

export interface UserQuery {
  organizationId?: string;
}

export interface CreateTeamMemberRequest {
  email: string;
  fullName: string;
  password: string;
  role: Role;
}
