// Smoke test + signup password-match validation for the AuthLanding component.
//
// Without Babel's jest-hoist plugin, SWC compiles static imports to top-level
// requires that run before jest.mock() calls in the module body. To avoid
// loading auth-landing.tsx (and thus @tanstack/react-router) before the mocks
// are registered, AuthLanding is loaded lazily in beforeAll().

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

// ---------------------------------------------------------------------------
// Module mocks - registered in module body; auth-landing is required later in
// beforeAll so these are in place when it loads.
// ---------------------------------------------------------------------------

jest.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => Promise.resolve(),
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to, ...rest }, children),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
    error: null,
  })),
}));

jest.mock('~/lib/api-client', () => ({
  apiClient: {
    login: jest.fn(),
    register: jest.fn(),
    googleSignIn: jest.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    status: number;
    details: unknown;
    constructor(message: string, status: number, details: unknown) {
      super(message);
      this.name = 'ApiClientError';
      this.status = status;
      this.details = details;
    }
  },
}));

jest.mock('~/lib/auth-storage', () => ({
  saveSession: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Lazy load AuthLanding after mocks are registered
// ---------------------------------------------------------------------------

type AuthMode = 'login' | 'signup';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AuthLanding: (props: { mode: AuthMode }) => any;

beforeAll(() => {
  AuthLanding = (require('../auth-landing') as { AuthLanding: typeof AuthLanding }).AuthLanding;
});

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderAuthLanding(mode: AuthMode) {
  return render(
    <MantineProvider>
      <AuthLanding mode={mode} />
    </MantineProvider>,
  );
}

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe('AuthLanding smoke', () => {
  it('renders the login form without crashing', () => {
    renderAuthLanding('login');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the signup form without crashing', () => {
    renderAuthLanding('signup');
    expect(
      screen.getByRole('button', { name: /create workspace/i }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Signup: password-match validation
// ---------------------------------------------------------------------------

describe('SignupForm password-match validation', () => {
  function getSignupFields() {
    return {
      orgName: screen.getByLabelText(/organization/i),
      fullName: screen.getByLabelText(/full name/i),
      email: screen.getByLabelText(/work email/i),
      // Mantine appends " *" inside an aria-hidden span for required fields;
      // use a starts-with anchor so this matches "Password *" but not "Confirm password *".
      password: screen.getByLabelText(/^password/i),
      confirmPassword: screen.getByLabelText(/confirm password/i),
      submit: screen.getByRole('button', { name: /create workspace/i }),
    };
  }

  function fillForm(
    fields: ReturnType<typeof getSignupFields>,
    pw: string,
    confirm: string,
  ) {
    fireEvent.change(fields.orgName, { target: { value: 'Test Corp' } });
    fireEvent.change(fields.fullName, { target: { value: 'Alice' } });
    fireEvent.change(fields.email, { target: { value: 'alice@example.com' } });
    fireEvent.change(fields.password, { target: { value: pw } });
    fireEvent.change(fields.confirmPassword, { target: { value: confirm } });
  }

  it('shows "Passwords do not match" when confirm differs from password', async () => {
    renderAuthLanding('signup');
    const fields = getSignupFields();

    fillForm(fields, 'secret123', 'different');
    fireEvent.click(fields.submit);

    await waitFor(() => {
      expect(
        screen.getByText('Passwords do not match'),
      ).toBeInTheDocument();
    });
  });

  it('shows "Please confirm your password" when confirm is empty on submit', async () => {
    // When confirmPassword is empty and `required` is set on the input, jsdom's
    // native constraint validation prevents the `submit` event from firing.
    // Dispatch the submit event directly on the <form> element to bypass native
    // validation so TanStack Form's onSubmit validators can run.
    const { container } = renderAuthLanding('signup');
    const fields = getSignupFields();

    fireEvent.change(fields.orgName, { target: { value: 'Test Corp' } });
    fireEvent.change(fields.fullName, { target: { value: 'Alice' } });
    fireEvent.change(fields.email, { target: { value: 'alice@example.com' } });
    fireEvent.change(fields.password, { target: { value: 'secret123' } });
    // Leave confirmPassword empty, then submit the <form> directly.
    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText('Please confirm your password'),
      ).toBeInTheDocument();
    });
  });

  it('does NOT show a password-match error when passwords are identical', async () => {
    renderAuthLanding('signup');
    const fields = getSignupFields();

    fillForm(fields, 'secret123', 'secret123');

    await waitFor(() => {
      expect(
        screen.queryByText('Passwords do not match'),
      ).not.toBeInTheDocument();
    });
  });
});
