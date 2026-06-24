import type { CurrentUser, LoginResponse } from '@nx-temp/data';

const sessionKey = 'turbo-vets.web.session';

export interface StoredSession {
  accessToken: string;
  user: CurrentUser;
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(sessionKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    window.localStorage.removeItem(sessionKey);
    return null;
  }
}

export function saveSession(session: LoginResponse) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    sessionKey,
    JSON.stringify({
      accessToken: session.accessToken,
      user: session.user,
    }),
  );
}

export function clearSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(sessionKey);
}
