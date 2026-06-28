import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginAttemptService } from './login-attempt.service';

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
});
