import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { LoginRequest, RegisterRequest } from '@nx-temp/data';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { apiClient, ApiClientError } from '~/lib/api-client';
import { saveSession } from '~/lib/auth-storage';

type AuthMode = 'login' | 'signup';

export const Route = createFileRoute('/')({
  component: AuthLandingPage,
});

function AuthLandingPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginForm, setLoginForm] = useState<LoginRequest>({
    email: 'owner@acme.test',
    password: 'Password123!',
  });
  const [signupForm, setSignupForm] = useState<RegisterRequest>({
    organizationName: '',
    fullName: '',
    email: '',
    password: '',
  });
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: apiClient.login,
    onSuccess: (session) => {
      saveSession(session);
      setSessionSummary(
        `${session.user.fullName} signed in to ${session.user.organizationName}`,
      );
    },
  });

  const signupMutation = useMutation({
    mutationFn: apiClient.register,
    onSuccess: (session) => {
      saveSession(session);
      setSessionSummary(
        `${session.user.fullName} created ${session.user.organizationName}`,
      );
    },
  });

  const pending = loginMutation.isPending || signupMutation.isPending;
  const activeError = useMemo(() => {
    const error = loginMutation.error ?? signupMutation.error;
    if (!error) {
      return null;
    }

    return error instanceof ApiClientError
      ? error.message
      : 'Something went wrong. Try again.';
  }, [loginMutation.error, signupMutation.error]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface shadow-panel lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between border-b border-border bg-[#102033] p-6 text-white lg:border-b-0 lg:border-r lg:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#102033]">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-100">
                Turbo Vets
              </p>
              <p className="text-sm text-slate-300">SaaS work management</p>
            </div>
          </div>

          <div className="my-12 max-w-xl">
            <h1 className="text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
              Plan sprints, manage issues, and keep tenant data separated.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              This React foundation keeps NestJS as the API owner while the new
              dashboard moves to TanStack Start, shared contracts, and a richer
              component system.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Multi-org ready', Users],
              ['Google and password auth', ShieldCheck],
              ['Sprints and epics', Sparkles],
              ['Resend invite flow', Mail],
            ].map(([label, Icon]) => (
              <div
                key={label as string}
                className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100"
              >
                <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
                <span>{label as string}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-6 flex rounded-md bg-muted p-1">
              <button
                className={`h-9 flex-1 rounded px-3 text-sm font-semibold transition ${
                  mode === 'login'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
                type="button"
                onClick={() => setMode('login')}
              >
                Sign in
              </button>
              <button
                className={`h-9 flex-1 rounded px-3 text-sm font-semibold transition ${
                  mode === 'signup'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
                type="button"
                onClick={() => setMode('signup')}
              >
                Create org
              </button>
            </div>

            <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-2xl font-semibold tracking-normal">
                  {mode === 'login' ? 'Welcome back' : 'Start a workspace'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === 'login'
                    ? 'Use the existing API while the React dashboard reaches parity.'
                    : 'Create the first organization owner with the current NestJS endpoint.'}
                </p>
              </div>

              {mode === 'login' ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    loginMutation.mutate(loginForm);
                  }}
                >
                  <Field label="Email" icon={<Mail className="h-4 w-4" />}>
                    <input
                      className="auth-input pl-9"
                      type="email"
                      autoComplete="email"
                      value={loginForm.email}
                      onChange={(event) =>
                        setLoginForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <Field
                    label="Password"
                    icon={<LockKeyhole className="h-4 w-4" />}
                  >
                    <input
                      className="auth-input pl-9"
                      type="password"
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <SubmitButton pending={pending}>Sign in</SubmitButton>
                </form>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    signupMutation.mutate(signupForm);
                  }}
                >
                  <Field
                    label="Organization"
                    icon={<Building2 className="h-4 w-4" />}
                  >
                    <input
                      className="auth-input pl-9"
                      value={signupForm.organizationName}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          organizationName: event.target.value,
                        }))
                      }
                      required
                      minLength={2}
                    />
                  </Field>
                  <Field label="Full name">
                    <input
                      className="auth-input"
                      value={signupForm.fullName}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <Field label="Work email" icon={<Mail className="h-4 w-4" />}>
                    <input
                      className="auth-input pl-9"
                      type="email"
                      autoComplete="email"
                      value={signupForm.email}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <Field
                    label="Password"
                    icon={<LockKeyhole className="h-4 w-4" />}
                  >
                    <input
                      className="auth-input pl-9"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={signupForm.password}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                  <SubmitButton pending={pending}>Create workspace</SubmitButton>
                </form>
              )}

              {activeError ? (
                <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {activeError}
                </p>
              ) : null}

              {sessionSummary ? (
                <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {sessionSummary}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="auth-label">{label}</span>
      <span className="relative mt-1 block">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        ) : null}
        {children}
      </span>
    </label>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      <span>{children}</span>
      {!pending ? <ArrowRight className="h-4 w-4" /> : null}
    </Button>
  );
}
