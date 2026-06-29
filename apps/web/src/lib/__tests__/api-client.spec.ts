// api-client unit tests.
//
// auth-storage reads directly from window.localStorage, so we control the
// session state by writing to localStorage - no mock needed.
// fetch is mocked globally for each test.

import { apiClient, ApiClientError } from '../api-client';

// Session key mirrors the one in auth-storage.ts (kept in sync via this
// import-free reference so the test stays a black-box test).
const SESSION_KEY = 'turbo-vets.web.session';

function setSession(accessToken: string) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ accessToken, user: { id: 'u1' } }),
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function mockFetch(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
    blob: () => Promise.resolve(new Blob([text])),
  } as unknown as Response);
}

function capturedRequest() {
  return (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
}

beforeEach(() => {
  clearSession();
  jest.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Request shaping
// ---------------------------------------------------------------------------

describe('request shaping', () => {
  it('constructs the correct URL for GET /auth/me', async () => {
    mockFetch(200, { id: '1', email: 'u@test.com' });
    await apiClient.me();
    const [url] = capturedRequest();
    expect(url).toMatch(/\/auth\/me$/);
  });

  it('builds query params for listTasks', async () => {
    mockFetch(200, []);
    await apiClient.listTasks({ sortBy: 'position', order: 'asc' });
    const [url] = capturedRequest();
    expect(url).toContain('sortBy=position');
    expect(url).toContain('order=asc');
  });

  it('omits empty-string query params', async () => {
    mockFetch(200, []);
    await apiClient.listTasks({ search: '', sortBy: 'position' });
    const [url] = capturedRequest();
    expect(url).not.toContain('search=');
    expect(url).toContain('sortBy=position');
  });

  it('produces a URL with no query string when no params are given', async () => {
    mockFetch(200, []);
    await apiClient.listTasks();
    const [url] = capturedRequest();
    expect(url).not.toContain('?');
  });

  it('serialises POST body as JSON', async () => {
    mockFetch(200, { accessToken: 'tok', user: {} });
    await apiClient.login({ email: 'a@b.com', password: 'pw' });
    const [, init] = capturedRequest();
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@b.com',
      password: 'pw',
    });
  });

  it('sets Content-Type: application/json', async () => {
    mockFetch(200, {});
    await apiClient.me();
    const [, init] = capturedRequest();
    expect(new Headers(init.headers).get('Content-Type')).toBe(
      'application/json',
    );
  });
});

// ---------------------------------------------------------------------------
// Auth header
// ---------------------------------------------------------------------------

describe('auth header', () => {
  it('includes Bearer token when a session is present in localStorage', async () => {
    setSession('my-token');
    mockFetch(200, {});
    await apiClient.me();
    const [, init] = capturedRequest();
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer my-token',
    );
  });

  it('omits Authorization when localStorage has no session', async () => {
    clearSession();
    mockFetch(200, {});
    await apiClient.me();
    const [, init] = capturedRequest();
    expect(new Headers(init.headers).get('Authorization')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

describe('error mapping', () => {
  it('throws ApiClientError with the HTTP status on non-ok responses', async () => {
    mockFetch(401, { message: 'Unauthorized' });
    let caught: unknown;
    try {
      await apiClient.me();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiClientError);
    expect((caught as ApiClientError).status).toBe(401);
  });

  it('uses the "message" string from the response body', async () => {
    mockFetch(400, { message: 'Email already in use' });
    let caught: unknown;
    try {
      await apiClient.login({ email: 'x', password: 'y' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiClientError);
    expect((caught as ApiClientError).message).toBe('Email already in use');
  });

  it('joins a "message" array with ", "', async () => {
    mockFetch(422, { message: ['field required', 'invalid email'] });
    let caught: unknown;
    try {
      await apiClient.register({
        email: '',
        password: '',
        fullName: '',
        organizationName: '',
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiClientError);
    expect((caught as ApiClientError).message).toBe(
      'field required, invalid email',
    );
  });

  it('falls back to "Request failed with <status>" when no message field', async () => {
    mockFetch(500, { error: 'internal' });
    let caught: unknown;
    try {
      await apiClient.me();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiClientError);
    expect((caught as ApiClientError).message).toBe(
      'Request failed with 500',
    );
  });

  it('returns null for an empty response body on a successful request', async () => {
    mockFetch(204, '');
    const result = await apiClient.deleteTask('task-1');
    expect(result).toBeNull();
  });
});
