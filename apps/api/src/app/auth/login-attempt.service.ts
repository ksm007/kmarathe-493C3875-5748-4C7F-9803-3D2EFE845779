import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AttemptRecord {
  failures: number;
  /** Epoch millis until which the account is locked, or null when not locked. */
  lockedUntil: number | null;
}

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
    const key = this.keyFor(email);
    const record = this.attempts.get(key) ?? { failures: 0, lockedUntil: null };
    record.failures += 1;
    if (record.failures >= this.maxAttempts) {
      record.lockedUntil = Date.now() + this.lockoutMs;
    }
    this.attempts.set(key, record);
  }

  /** Clears all failed-attempt state for an account after a successful login. */
  reset(email: string): void {
    this.attempts.delete(this.keyFor(email));
  }

  private keyFor(email: string): string {
    return email.trim().toLowerCase();
  }
}
