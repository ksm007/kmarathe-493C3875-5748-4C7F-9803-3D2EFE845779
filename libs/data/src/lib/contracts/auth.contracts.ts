import { CurrentUser } from '../models/user';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

export interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
  organizationName: string;
}

export interface GoogleSignInRequest {
  idToken: string;
}

export interface GoogleAuthSession {
  kind: 'session';
  accessToken: string;
  user: CurrentUser;
}

export interface GoogleAuthNeedsOrg {
  kind: 'needs-org';
  email: string;
  fullName: string;
  hasPendingInvitations: boolean;
}

export type GoogleAuthResponse = GoogleAuthSession | GoogleAuthNeedsOrg;
