import { Role } from './roles';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
  organizationName: string;
}

export interface User extends CurrentUser {
  createdAt: string;
  updatedAt: string;
}
