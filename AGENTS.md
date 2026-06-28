# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Auth rate limiting & brute-force protection (apps/api)

- `@nestjs/throttler` is wired in `apps/api/src/app/app.module.ts` via `ThrottlerModule.forRootAsync` (config-driven, per-IP). It defines TWO named throttlers: `'auth'` (tight, `AUTH_RATE_LIMIT_*`) for the public abuse-prone routes, and `'invite'` (higher, `INVITE_RATE_LIMIT_*`) for the authenticated bulk-invite create route. `ThrottlerModule` is `@Global`, but the `ThrottlerGuard` is intentionally NOT registered as an `APP_GUARD` - it is opt-in per route via `@UseGuards(ThrottlerGuard)` so normal authenticated app traffic is never throttled. The guard enforces ALL named throttlers, so each route scopes itself to exactly one with `@SkipThrottle`: `POST /auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, and `POST /invitations/accept` use `@SkipThrottle({ invite: true })` (so only `'auth'` applies); `POST /invitations` (create) uses `@SkipThrottle({ auth: true })` (so only the higher `'invite'` limit applies).
- Per-account login brute-force protection lives in `apps/api/src/app/auth/login-attempt.service.ts` (in-memory, mirrors `chat/chat-rate-limiter.service.ts`). `AuthService.login` calls `assertNotLocked` → `recordFailure`/`reset`; lockout returns HTTP 429. The attempts map is keyed by attacker-controlled email, so `recordFailure` opportunistically sweeps stale/expired entries and enforces a hard `MAX_TRACKED_ACCOUNTS` cap (evicting oldest non-locked first) to bound memory under credential-stuffing.
- The AI chat limiter (`chat/chat-rate-limiter.service.ts`) is a separate, independent mechanism - do not fold it into the throttler.
- Thresholds/TTLs are env vars validated in `apps/api/src/app/config/env.validation.ts`: `AUTH_RATE_LIMIT_TTL_SECONDS`, `AUTH_RATE_LIMIT_MAX`, `INVITE_RATE_LIMIT_TTL_SECONDS`, `INVITE_RATE_LIMIT_MAX`, `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_SECONDS` (all have defaults; also in `.env.example`).
- Tests: `auth/auth-throttler.spec.ts` (HTTP 429 via supertest), `auth/login-attempt.service.spec.ts` (lockout + recovery with fake timers), and lockout cases in `api.integration.spec.ts`. Note: `api.integration.spec.ts` constructs services by hand - adding an `AuthService` constructor param means updating that wiring.
