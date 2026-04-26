import { CurrentUser } from '@nx-temp/data';
import { Injectable } from '@angular/core';

interface StoredSession {
  token: string;
  user: CurrentUser;
}

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  private readonly key = 'secure-task-dashboard.session';

  getSession(): StoredSession | null {
    const raw = sessionStorage.getItem(this.key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      this.clear();
      return null;
    }
  }

  getToken(): string | null {
    return this.getSession()?.token ?? null;
  }

  saveSession(token: string, user: CurrentUser) {
    sessionStorage.setItem(this.key, JSON.stringify({ token, user }));
  }

  clear() {
    sessionStorage.removeItem(this.key);
  }
}
