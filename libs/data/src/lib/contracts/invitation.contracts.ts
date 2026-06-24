import { Role } from '../models/roles';

export interface CreateInvitationRequest {
  email: string;
  role: Role;
}

export interface AcceptInvitationRequest {
  token: string;
  fullName: string;
  password: string;
}

export interface InvitationResponse {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface SwitchOrgRequest {
  organizationId: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
