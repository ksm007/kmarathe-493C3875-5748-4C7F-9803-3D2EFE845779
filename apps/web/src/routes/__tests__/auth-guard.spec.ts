// Auth guard tests.
//
// The _authed route's beforeLoad calls getStoredSession() and throws redirect()
// when there is no session.  The _admin guard additionally checks the role.
// We test both routes' beforeLoad functions by mocking their heavy UI and
// framework dependencies and importing just the Route options.

import type { StoredSession } from '~/lib/auth-storage';
import type { CurrentUser } from '@nx-temp/data';
import { Role } from '@nx-temp/data';

// ---------------------------------------------------------------------------
// Shared: spy on getStoredSession across both guard tests
// ---------------------------------------------------------------------------

const mockGetStoredSession = jest.fn<StoredSession | null, []>();

// The mock must be declared before any dynamic import/require of route modules.
jest.mock('~/lib/auth-storage', () => ({
  getStoredSession: (...args: unknown[]) => mockGetStoredSession(...args),
  clearSession: jest.fn(),
  saveSession: jest.fn(),
}));

// ---------------------------------------------------------------------------
// _authed route guard  (apps/web/src/routes/_authed.tsx)
// ---------------------------------------------------------------------------

// Stub out every non-essential import so the module resolves without a
// real router or Mantine setup.
jest.mock('@mantine/core', () => ({}));
jest.mock('@mantine/notifications', () => ({}));
jest.mock('lucide-react', () => ({}));
jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useQueryClient: jest.fn(() => ({
    clear: jest.fn(),
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  })),
}));
jest.mock('~/lib/use-current-user', () => ({
  useCurrentUser: jest.fn(() => ({
    id: 'u1',
    organizationId: 'org1',
    organizationName: 'Org',
    role: Role.Owner,
    memberships: [],
  })),
}));
jest.mock('~/lib/api-client', () => ({
  apiClient: { switchOrg: jest.fn() },
  ApiClientError: class extends Error {},
}));
jest.mock('~/lib/format', () => ({ formatError: jest.fn((e) => String(e)) }));

// Intercept createFileRoute so we can retrieve the options object.
// redirect throws an error we can inspect.
const mockRedirect = jest.fn((opts: { to: string }) => {
  const err = Object.assign(new Error(`Redirect → ${opts.to}`), {
    isRedirect: true,
    to: opts.to,
  });
  throw err;
});

let capturedAuthedOptions: Record<string, unknown> = {};
jest.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => {
    capturedAuthedOptions = options;
    return { options };
  },
  redirect: mockRedirect,
  Outlet: () => null,
  Link: (props: Record<string, unknown>) => props['children'],
  useNavigate: () => jest.fn(),
  useRouterState: () => ({ location: { pathname: '/tasks' } }),
}));

// Import after all jest.mock() calls so they are hoisted correctly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Route: authedRoute } = require('~/routes/_authed') as {
  Route: { options: { beforeLoad: () => { user: CurrentUser } } };
};

// ---------------------------------------------------------------------------

function makeSession(roleOverride: Role = Role.Owner): StoredSession {
  return {
    accessToken: 'tok',
    user: {
      id: 'u1',
      email: 'u@example.com',
      fullName: 'Test User',
      role: roleOverride,
      organizationId: 'org-1',
      organizationName: 'Org',
      memberships: [],
    } as unknown as CurrentUser,
  };
}

describe('_authed beforeLoad guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws a redirect to /login when no session is stored', () => {
    mockGetStoredSession.mockReturnValue(null);
    expect(() => authedRoute.options.beforeLoad()).toThrow('Redirect → /login');
    expect(mockRedirect).toHaveBeenCalledWith({ to: '/login' });
  });

  it('returns the stored user in context when a session is present', () => {
    const session = makeSession();
    mockGetStoredSession.mockReturnValue(session);
    const context = authedRoute.options.beforeLoad();
    expect(context).toEqual({ user: session.user });
  });
});

// ---------------------------------------------------------------------------
// _admin route guard  (apps/web/src/routes/_authed._admin.tsx)
// ---------------------------------------------------------------------------
// This module has minimal imports (Outlet, createFileRoute, redirect + Role/auth-storage),
// so we test it in a fresh module scope by overriding the mock for createFileRoute.

let capturedAdminOptions: Record<string, unknown> = {};
// Re-mock createFileRoute to capture the admin guard options.
// jest.mock() calls are de-duped per module ID; since we already mocked
// @tanstack/react-router above we override the factory with resetModules.
describe('_admin beforeLoad guard', () => {
  let adminBeforeLoad: () => void;

  beforeAll(() => {
    jest.resetModules();

    // Re-apply mocks after resetModules.
    jest.mock('~/lib/auth-storage', () => ({
      getStoredSession: (...args: unknown[]) => mockGetStoredSession(...args),
      clearSession: jest.fn(),
      saveSession: jest.fn(),
    }));

    jest.mock('@tanstack/react-router', () => ({
      createFileRoute: () => (options: Record<string, unknown>) => {
        capturedAdminOptions = options;
        return { options };
      },
      redirect: mockRedirect,
      Outlet: () => null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Route } = require('~/routes/_authed._admin') as {
      Route: { options: { beforeLoad: () => void } };
    };
    adminBeforeLoad = Route.options.beforeLoad;
  });

  beforeEach(() => jest.clearAllMocks());

  it('throws a redirect to /tasks for users with the Viewer role', () => {
    mockGetStoredSession.mockReturnValue(makeSession(Role.Viewer));
    expect(() => adminBeforeLoad()).toThrow('Redirect → /tasks');
    expect(mockRedirect).toHaveBeenCalledWith({ to: '/tasks' });
  });

  it('allows Admins through without redirecting', () => {
    mockGetStoredSession.mockReturnValue(makeSession(Role.Admin));
    expect(() => adminBeforeLoad()).not.toThrow();
  });

  it('allows Owners through without redirecting', () => {
    mockGetStoredSession.mockReturnValue(makeSession(Role.Owner));
    expect(() => adminBeforeLoad()).not.toThrow();
  });
});
