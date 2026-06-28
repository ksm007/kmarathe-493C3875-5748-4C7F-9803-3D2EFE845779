import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AttemptRecord {
  failures: number;
  /** Epoch millis until which the account is locked, or null when not locked. */
  lockedUntil: number | null;
  /** Epoch millis of the most recent failed attempt, used for eviction. */
  lastUpdated: number;
}

/**
 * Hard safety cap on the number of distinct accounts tracked at once. The email
 * key space is attacker-controlled (failed logins against non-existent emails
 * still create records), so this bounds memory even under credential-stuffing
 * with rotating addresses.
 */
export const MAX_TRACKED_ACCOUNTS = 10_000;

/**
 * Per-account brute-force protection for login.
 *
 * Tracks consecutive failed login attempts keyed by email and locks the account
 * for a configurable window once the failure threshold is reached. A successful
 * login resets the counter. State is in-memory, mirroring {@link ../chat/chat-rate-limiter.service}.
 */
@Injectable()
export class LoginAttemptService {
  private readonly attempts = new Map<string, AttemptRecord>();

  constructor(private readonly configService: ConfigService) {}

  private get maxAttempts(): number {
    return this.configService.get<number>('LOGIN_MAX_FAILED_ATTEMPTS', 5);
  }

  private get lockoutMs(): number {
    return this.configService.get<number>('LOGIN_LOCKOUT_SECONDS', 900) * 1000;
  }

  /**
   * Throws `429 Too Many Requests` when the account is currently locked.
   * Call this before verifying credentials. Expired locks are cleared lazily.
   */
  assertNotLocked(email: string): void {
    const key = this.keyFor(email);
    const record = this.attempts.get(key);
    if (!record?.lockedUntil) return;

    const now = Date.now();
    if (record.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      throw new HttpException(
        `Account temporarily locked due to too many failed login attempts. Try again in ${retryAfterSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Lock window has elapsed - forget the account so it starts fresh.
    this.attempts.delete(key);
  }

  /**
   * Records a failed login attempt and locks the account once the configured
   * threshold is reached.
   */
  recordFailure(email: string): void {
    const now = Date.now();
    const key = this.keyFor(email);
    const record = this.attempts.get(key) ?? { failures: 0, lockedUntil: null, lastUpdated: now };
    record.failures += 1;
    record.lastUpdated = now;
    if (record.failures >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutMs;
    }
    this.attempts.set(key, record);
    this.sweep(now);
  }

  /** Clears all failed-attempt state for an account after a successful login. */
  reset(email: string): void {
    this.attempts.delete(this.keyFor(email));
  }

  /**
   * Opportunistically bound the in-memory map. Drops entries that are not
   * currently locked and whose last failure is older than the lockout window
   * (stale sub-threshold or expired records), then enforces a hard size cap by
   * evicting the oldest entries - preferring non-locked ones - if still over.
   */
  private sweep(now: number): void {
    const staleBefore = now - this.lockoutMs;
    for (const [key, record] of this.attempts) {
      const locked = record.lockedUntil !== null && record.lockedUntil > now;
      if (!locked && record.lastUpdated < staleBefore) {
        this.attempts.delete(key);
      }
    }

    if (this.attempts.size <= MAX_TRACKED_ACCOUNTS) return;

    const entries = [...this.attempts.entries()].sort((a, b) => {
      const aLocked = a[1].lockedUntil !== null && a[1].lockedUntil > now;
      const bLocked = b[1].lockedUntil !== null && b[1].lockedUntil > now;
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return a[1].lastUpdated - b[1].lastUpdated;
    });

    for (const [key] of entries) {
      if (this.attempts.size <= MAX_TRACKED_ACCOUNTS) break;
      this.attempts.delete(key);
    }
  }

  private keyFor(email: string): string {
    return email.trim().toLowerCase();
  }
}
