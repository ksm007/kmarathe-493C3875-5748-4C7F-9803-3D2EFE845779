# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Auth rate limiting & brute-force protection (apps/api)

- `@nestjs/throttler` is wired in `apps/api/src/app/app.module.ts` via `ThrottlerModule.forRootAsync` (config-driven, per-IP). It defines TWO named throttlers: `'auth'` (tight, `AUTH_RATE_LIMIT_*`) for the public abuse-prone routes, and `'invite'` (higher, `INVITE_RATE_LIMIT_*`) for the authenticated bulk-invite create route. `ThrottlerModule` is `@Global`, but the `ThrottlerGuard` is intentionally NOT registered as an `APP_GUARD` - it is opt-in per route via `@UseGuards(ThrottlerGuard)` so normal authenticated app traffic is never throttled. The guard enforces ALL named throttlers, so each route scopes itself to exactly one with `@SkipThrottle`: `POST /auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, and `POST /invitations/accept` use `@SkipThrottle({ invite: true })` (so only `'auth'` applies); `POST /invitations` (create) uses `@SkipThrottle({ auth: true })` (so only the higher `'invite'` limit applies).
- Per-account login brute-force protection lives in `apps/api/src/app/auth/login-attempt.service.ts` (in-memory, mirrors `chat/chat-rate-limiter.service.ts`). `AuthService.login` calls `assertNotLocked` → `recordFailure`/`reset`; lockout returns HTTP 429. The attempts map is keyed by attacker-controlled email, so `recordFailure` opportunistically sweeps stale/expired entries and enforces a hard `MAX_TRACKED_ACCOUNTS` cap (evicting oldest non-locked first) to bound memory under credential-stuffing.
- The AI chat limiter (`chat/chat-rate-limiter.service.ts`) is a separate, independent mechanism - do not fold it into the throttler.
- Thresholds/TTLs are env vars validated in `apps/api/src/app/config/env.validation.ts`: `AUTH_RATE_LIMIT_TTL_SECONDS`, `AUTH_RATE_LIMIT_MAX`, `INVITE_RATE_LIMIT_TTL_SECONDS`, `INVITE_RATE_LIMIT_MAX`, `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_SECONDS` (all have defaults; also in `.env.example`).
- Tests: `auth/auth-throttler.spec.ts` (HTTP 429 via supertest), `auth/login-attempt.service.spec.ts` (lockout + recovery with fake timers), and lockout cases in `api.integration.spec.ts`. Note: `api.integration.spec.ts` constructs services by hand - adding an `AuthService` constructor param means updating that wiring.

## Task attachment storage

- `AttachmentStorageService` (`apps/api/src/app/tasks/attachment-storage.service.ts`) is the single storage seam used by `TasksService` for image attachments. It is a thin facade that delegates `save`/`createReadStream`/`openReadStream`/`remove` to an adapter selected at construction from env config.
- Adapters live in `apps/api/src/app/tasks/storage/`: `local-disk-...` (dev/test default, disk via `fs`, the seam's placeholder) and `cloudinary-...` (production, official `cloudinary` SDK). Selection is in `attachment-storage.factory.ts` keyed on `ATTACHMENT_STORAGE_PROVIDER` (`local` default, `cloudinary`). See ADR 0024. (S3 is not implemented; it could be added later behind the same seam.)
- The seam exposes a synchronous `createReadStream(): Readable` (so the controller can wrap it in `StreamableFile`). The Cloudinary adapter stores assets as `authenticated` (private at the CDN), uses the opaque `storageKey` minus its file extension as the public id, and on read signs a delivery URL and proxies the bytes back through the existing authenticated serving endpoint - keeping private attachments private without changing the controller contract. It bridges the async fetch through a `PassThrough` and surfaces failures as stream `error` events.
- Cloudinary env vars (`CLOUDINARY_URL`, or `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`) are validated in `apps/api/src/app/config/env.validation.ts` only when the provider is `cloudinary`, and documented in `.env.example`.
- Tests: `tasks/storage/attachment-storage.spec.ts` covers adapter selection (factory), Cloudinary adapter upload/read/delete/stream behavior via injected mock, and `fetchWithRedirects` edge cases (off-domain rejection, hop cap, NaN/missing Content-Length).

## Task activity emission (apps/api)

- Activity types are defined in `libs/data/src/lib/models/task.ts` (`TaskActivityType`).
  Every `updateTask` always emits `task_updated`.
  Six field changes emit an additional discrete activity alongside it: `status_changed`, `epic_changed`, `sprint_changed`, `acceptance_criteria_changed`, `story_point_changed`, and `assignee_changed`.
- `story_point_changed` is emitted before `loadTaskWithRelations` (it only needs the scalar before/after values).
  `assignee_changed` is emitted after `loadTaskWithRelations` because it reads `hydratedTask.assignee.fullName` to populate `toName` in the metadata.
  The ordering is intentional; do not move `assignee_changed` above the hydration call.
- Both discrete activities are suppressed when the value did not actually change (guard: `previousX !== task.X`).
  They are also suppressed when the field is absent from the payload (`payload.x !== undefined` guard).
- Metadata shape: `assignee_changed` carries `{ from, fromName, to, toName }` (ids + display names, either may be `null`); `story_point_changed` carries `{ from, to }` (numbers or `null`).
- Tests: `apps/api/src/app/tasks/tasks-activity.spec.ts` (unit, no DB - mocks repositories by hand).

## apps/web routing (TanStack Start)

File-based routes live in `apps/web/src/routes`; `routeTree.gen.ts` is auto-generated by the `tanstackStart` Vite plugin.
It regenerates on `vite dev` and at the start of `vite build`, NOT during `tsc`.
After adding/removing/renaming a route file, run `npx nx build web` (or the dev server) to refresh `routeTree.gen.ts` before `npx nx typecheck web`, otherwise typecheck sees the stale tree.

Auth lives in `localStorage` (bearer token via `~/lib/auth-storage`), which is invisible during SSR.
Any route whose `beforeLoad`/`loader`/component depends on the session must set `ssr: false` so those hooks run on the client.
The authenticated area is a pathless `_authed` layout (`ssr: false`) whose `beforeLoad` redirects to `/login` when there is no session and exposes the user via route context; nested `_authed/_admin` is a second pathless layout that redirects non-admins (owner/admin only) to `/tasks` and wraps sprints + audit-log.
`/login` and `/signup` also set `ssr: false` so their "already signed in -> /tasks" guard can read localStorage.

Route `loader`s use `queryClient.prefetchQuery` (the shared singleton from `~/lib/query-client`), not `ensureQueryData`: prefetch warms the cache without throwing on fetch failure, so components keep their own `useQuery` loading/error UI instead of crashing the route into the error boundary.
Live session/user reads go through `useCurrentUser()` (the `['me']` query), so the org switcher stays reactive.

The `_authed/tasks/$id` route (`apps/web/src/routes/_authed.tasks.$id.tsx`) is a URL-driven deep link for task detail - the URL is bookmarkable and shareable.
Its close handler calls `router.history.back()` when `window.history.length > 1` so navigating from the AI-chat source badge or a direct link returns the user to the previous page; it falls back to `navigate({ to: '/tasks' })` for cold loads with no prior history.
Do not replace this with a plain `navigate({ to: '/tasks' })` - that would break back-navigation from the AI-chat page and other entry points.

## Google sign-in (apps/api + apps/web)

- Backend: `POST /auth/google` accepts `{ idToken: string }`. `AuthService.googleSignIn` delegates token verification to `GoogleVerifierService` (`auth/google-verifier.service.ts`), which wraps `google-auth-library`'s `OAuth2Client.verifyIdToken`. Never trust a client-supplied email/profile - only values extracted from the verified token are used.
- Response is discriminated by `kind`: `{ kind: 'session', accessToken, user }` for users with an org membership, or `{ kind: 'needs-org', email, fullName, hasPendingInvitations }` for users with no membership (ADR 0005). No org or user record is silently created for brand-new identities.
- Account linking (ADR 0011): if a verified Google email matches an existing password-only account, the `googleId` is persisted on first Google sign-in. Password sign-in continues to work alongside Google sign-in. User is found by `googleId` first, then by email.
- `GOOGLE_CLIENT_ID` env var is required for the backend (config default `''`, documented in `.env.example`). `VITE_GOOGLE_CLIENT_ID` is the matching Vite-exposed frontend env var; when omitted the Google button is hidden.
- Frontend: `AuthLanding` (`features/auth/auth-landing.tsx`) loads the Google Identity Services (GIS) script via `useEffect`, calls `google.accounts.id.initialize` + `renderButton`, and on credential response calls `apiClient.googleSignIn`. The `needs-org` response shows a contextual alert without navigating away.
- Rate limiting: `POST /auth/google` uses the same `auth` throttler as login/register (`@SkipThrottle({ invite: true })`).
- Tests: `auth/google-auth.spec.ts` covers token verification delegation, account linking, password sign-in coexistence, no-silent-org (ADR 0005), pending invitation detection; `auth/auth-throttler.spec.ts` covers 429 on the Google route. `api.integration.spec.ts` wires a `jest.fn()` stub as `GoogleVerifierService` - adding constructor params to `AuthService` requires updating both specs.
- `google-auth-library` is in root `package.json` dependencies.

## Invitation audit logging (apps/api)

- Three invitation lifecycle events are recorded via `AuditService`:
  `invitations.create` (actor = inviting user, `allowed=true`, no `resourceId`, metadata includes `role` and `targetEmail`);
  `invitations.accept` on success (actor constructed from the newly-created/existing user + membership + invitation.organization, `allowed=true`, `resourceId=invitation.id`);
  `invitations.accept` on failure - invalid, expired, or already-used token - (actor=null, `allowed=false`, `reason='Invite link is invalid or has expired'`).
- `create` audit is logged in `InvitationsService.create()` after the invitation email is sent.
  `accept` audits are logged in `AuthService.acceptInvitation()` before throwing on failure, and after marking `acceptedAt` on success.
- `AuthModule` and `InvitationsModule` both import `AuditModule` directly so `AuditService` is injectable.
- `AuditService` is now a constructor param of both `AuthService` and `InvitationsService`.
  When constructing either by hand in tests, pass a real `AuditService` (for integration tests that verify audit entries) or `{ log: jest.fn() } as unknown as AuditService` (for tests that do not).
  Existing specs updated: `api.integration.spec.ts` (real `auditService`), `auth/google-auth.spec.ts` (stub).
- Tests: `invitations/invitations-audit.spec.ts` (pg-mem, covers create/accept-success/accept-expired/accept-invalid/accept-replay).

## apps/web routing - public landing page

- The public marketing landing page lives at `apps/web/src/routes/index.tsx` (the `/` route).
  It redirects signed-in users to `/tasks`.
  The old `_authed.index.tsx` (which previously provided a `/` redirect to `/tasks` inside the authed layout) was removed because TanStack Router treats both files as the same `/` path and raises a conflicting-paths error at build time.
  When adding any route that competes with `/`, check for this conflict first.

## apps/web task analytics view

- The task board has three view modes: `board`, `list`, `analytics`.
  The `analytics` mode renders `TaskAnalyticsView` (defined inline in `_authed.tasks.tsx`) - stat cards, a completion `RingProgress`, and CSS bar charts using `PriorityBar` - no external chart library.
  The sprint filter axis uses a `sprintsQuery` loaded alongside `tasksQuery` via a separate `['sprints-all']` cache key.

## apps/web acceptance criteria interactive toggle

- `TaskDetailModal` persists AC toggle/add changes via `updateTask` (full criteria array replacement via `AcceptanceCriteriaInput[]`).
  Each toggle sends the whole current criteria list with the toggled item's `completed` flipped.
  New items use `id: ''` (the backend assigns an id on creation).
  The `TaskDetailSummary` subcomponent owns the AC UI and receives `onToggleCriterion`, `onAddCriterion`, and `criteriaUpdating` props from the parent modal.

## apps/web RBAC - Admin cannot remove Owner

- In `_authed.team.tsx` the Remove button is also disabled when `currentUser.role === Role.Admin && user.role === Role.Owner`.
  Only Owners can remove other Owners.
