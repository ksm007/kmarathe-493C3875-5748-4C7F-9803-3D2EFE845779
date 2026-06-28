import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginAttemptService, MAX_TRACKED_ACCOUNTS } from './login-attempt.service';

describe('LoginAttemptService', () => {
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_SECONDS = 60;
  let service: LoginAttemptService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-27T12:00:00.000Z'));
    service = new LoginAttemptService(
      new ConfigService({
        LOGIN_MAX_FAILED_ATTEMPTS: MAX_ATTEMPTS,
        LOGIN_LOCKOUT_SECONDS: LOCKOUT_SECONDS,
      })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not lock before the failure threshold is reached', () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      service.recordFailure('user@example.com');
    }
    expect(() => service.assertNotLocked('user@example.com')).not.toThrow();
  });

  it('locks the account once the threshold is reached and returns 429', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      service.recordFailure('user@example.com');
    }

    expect(() => service.assertNotLocked('user@example.com')).toThrow(HttpException);
    try {
      service.assertNotLocked('user@example.com');
      fail('expected assertNotLocked to throw');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('treats the email key case- and whitespace-insensitively', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      service.recordFailure('  User@Example.com ');
    }
    expect(() => service.assertNotLocked('user@example.com')).toThrow(HttpException);
  });

  it('recovers automatically once the lockout window elapses', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      service.recordFailure('user@example.com');
    }
    expect(() => service.assertNotLocked('user@example.com')).toThrow(HttpException);

    // Still locked just before the window closes.
    jest.advanceTimersByTime((LOCKOUT_SECONDS - 1) * 1000);
    expect(() => service.assertNotLocked('user@example.com')).toThrow(HttpException);

    // Window elapsed - the account is usable again and the counter is cleared.
    jest.advanceTimersByTime(2 * 1000);
    expect(() => service.assertNotLocked('user@example.com')).not.toThrow();

    // A fresh failure after recovery does not immediately re-lock.
    service.recordFailure('user@example.com');
    expect(() => service.assertNotLocked('user@example.com')).not.toThrow();
  });

  it('reset clears accumulated failures', () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      service.recordFailure('user@example.com');
    }
    service.reset('user@example.com');

    // After reset it takes the full threshold again to lock.
    service.recordFailure('user@example.com');
    expect(() => service.assertNotLocked('user@example.com')).not.toThrow();
  });

  it('evicts stale sub-threshold entries once the lockout window elapses', () => {
    // One sub-threshold failure - not locked, just a dangling record.
    service.recordFailure('stale@example.com');
    service.recordFailure('stale@example.com');

    // Let the lockout window fully elapse for the stale entry.
    jest.advanceTimersByTime((LOCKOUT_SECONDS + 1) * 1000);

    // Any later failure triggers an opportunistic sweep that drops the stale entry.
    service.recordFailure('other@example.com');

    // The stale entry was forgotten: a single fresh failure must not re-lock it
    // (it would if the previous two failures had survived, since MAX_ATTEMPTS = 3).
    service.recordFailure('stale@example.com');
    expect(() => service.assertNotLocked('stale@example.com')).not.toThrow();
  });

  it('enforces the size cap, evicting oldest non-locked entries while locked accounts stay locked', () => {
    // Oldest entry: sub-threshold (2 of 3 failures), not locked. If it survives,
    // one more failure would lock it - so eviction is observable below.
    service.recordFailure('oldest@example.com');
    service.recordFailure('oldest@example.com');

    jest.advanceTimersByTime(1000);

    // Lock a victim - newer than the oldest entry but protected by being locked.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      service.recordFailure('victim@example.com');
    }
    expect(() => service.assertNotLocked('victim@example.com')).toThrow(HttpException);

    // Fill past the cap. Total tracked = oldest + victim + (MAX-2) fillers = MAX + 1.
    for (let i = 0; i < MAX_TRACKED_ACCOUNTS - 1; i++) {
      service.recordFailure(`filler-${i}@example.com`);
    }

    // The still-locked victim is never evicted despite not being the newest.
    expect(() => service.assertNotLocked('victim@example.com')).toThrow(HttpException);

    // The oldest non-locked entry was evicted: its 2 prior failures are gone, so a
    // single fresh failure cannot lock it (it would, at 3, had it survived).
    service.recordFailure('oldest@example.com');
    expect(() => service.assertNotLocked('oldest@example.com')).not.toThrow();
  });
});
