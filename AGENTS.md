# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Auth rate limiting & brute-force protection (apps/api)

- `@nestjs/throttler` is wired in `apps/api/src/app/app.module.ts` via `ThrottlerModule.forRootAsync` (config-driven, per-IP). `ThrottlerModule` is `@Global`, but the `ThrottlerGuard` is intentionally NOT registered as an `APP_GUARD` - it is opt-in per route via `@UseGuards(ThrottlerGuard)` so normal authenticated app traffic is never throttled. Currently applied to the abuse-prone routes only: `POST /auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, and invitation create (`POST /invitations`) + accept (`POST /invitations/accept`).
- Per-account login brute-force protection lives in `apps/api/src/app/auth/login-attempt.service.ts` (in-memory, mirrors `chat/chat-rate-limiter.service.ts`). `AuthService.login` calls `assertNotLocked` → `recordFailure`/`reset`; lockout returns HTTP 429.
- The AI chat limiter (`chat/chat-rate-limiter.service.ts`) is a separate, independent mechanism - do not fold it into the throttler.
- Thresholds/TTLs are env vars validated in `apps/api/src/app/config/env.validation.ts`: `AUTH_RATE_LIMIT_TTL_SECONDS`, `AUTH_RATE_LIMIT_MAX`, `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_SECONDS` (all have defaults; also in `.env.example`).
- Tests: `auth/auth-throttler.spec.ts` (HTTP 429 via supertest), `auth/login-attempt.service.spec.ts` (lockout + recovery with fake timers), and lockout cases in `api.integration.spec.ts`. Note: `api.integration.spec.ts` constructs services by hand - adding an `AuthService` constructor param means updating that wiring.
