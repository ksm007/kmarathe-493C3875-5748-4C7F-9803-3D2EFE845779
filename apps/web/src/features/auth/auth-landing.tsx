import { useEffect, useRef, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Group,
  Paper,
  PasswordInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { LoginRequest, RegisterRequest } from '@nx-temp/data';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  ListChecks,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { apiClient, ApiClientError } from '~/lib/api-client';
import { saveSession } from '~/lib/auth-storage';

export type AuthMode = 'login' | 'signup';

// VITE_GOOGLE_CLIENT_ID must be set to enable the Google sign-in button.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

// Google Identity Services type shim (the library is loaded via script tag).
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: object) => void;
          cancel: () => void;
        };
      };
    };
  }
}

/**
 * Two-panel auth landing shared by the `/login` and `/signup` routes. The
 * segmented control navigates between the two routes rather than toggling local
 * state, so each mode owns a real URL.
 */
export function AuthLanding({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState<LoginRequest>({
    email: '',
    password: '',
  });
  const [signupForm, setSignupForm] = useState<RegisterRequest>({
    organizationName: '',
    fullName: '',
    email: '',
    password: '',
  });

  const loginMutation = useMutation({
    mutationFn: apiClient.login,
    onSuccess: async (session) => {
      saveSession(session);
      await navigate({ to: '/tasks' });
    },
  });

  const signupMutation = useMutation({
    mutationFn: apiClient.register,
    onSuccess: async (session) => {
      saveSession(session);
      await navigate({ to: '/tasks' });
    },
  });

  const googleSignInMutation = useMutation({
    mutationFn: apiClient.googleSignIn,
    onSuccess: async (result) => {
      if (result.kind === 'session') {
        saveSession({ accessToken: result.accessToken, user: result.user });
        await navigate({ to: '/tasks' });
      } else {
        // kind === 'needs-org': Google identity verified but no org membership yet.
        const hint = result.hasPendingInvitations
          ? 'You have a pending team invitation - check your email to accept it and join your org.'
          : 'Your Google account is verified but has no org. Use "Create org" to start a workspace, or accept a team invitation from your email.';
        setGoogleError(hint);
      }
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Google sign-in failed. Try again.';
      setGoogleError(message);
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

  // Load Google Identity Services script and render the sign-in button.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    const onCredentialResponse = (response: { credential: string }) => {
      setGoogleError(null);
      googleSignInMutation.mutate({ idToken: response.credential });
    };

    const initButton = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: onCredentialResponse,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: googleButtonRef.current.offsetWidth || 380,
        text: mode === 'login' ? 'signin_with' : 'signup_with',
      });
    };

    if (window.google) {
      initButton();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = initButton;
      document.head.appendChild(script);
    }

    return () => {
      window.google?.accounts.id.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, GOOGLE_CLIENT_ID]);

  return (
    <Box className="auth-page">
      <Container size="xl" py={{ base: 'md', md: 'xl' }}>
        <Paper withBorder shadow="xl" radius="md" className="auth-shell">
          <Box className="auth-shell-grid">
            <Box className="auth-panel">
              <Stack justify="space-between" h="100%" gap="xl">
                <Group gap="sm">
                  <ThemeIcon size={44} radius="md" color="gray.0" c="dark.8">
                    <ClipboardList size={22} aria-hidden="true" />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" fw={700} tt="uppercase" c="blue.1">
                      Turbo Vets
                    </Text>
                    <Text size="sm" c="gray.4">
                      SaaS work management
                    </Text>
                  </Box>
                </Group>

                <Stack gap="md" maw={560}>
                  <Title order={1} size="h1" lh={1.08} c="white">
                    Plan sprints, manage issues, and keep tenant data separated.
                  </Title>
                  <Text size="md" lh={1.7} c="gray.3">
                    Keep issue work, sprint flow, and team ownership visible
                    across every active organization.
                  </Text>
                </Stack>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {[
                    ['Multi-org ready', Users],
                    ['Password auth', ShieldCheck],
                    ['Sprints and epics', Sparkles],
                    ['Task workspace', ListChecks],
                  ].map(([label, Icon]) => (
                    <Paper
                      key={label as string}
                      radius="md"
                      p="sm"
                      className="auth-feature"
                    >
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon
                          size={30}
                          radius="md"
                          color="blue"
                          variant="light"
                        >
                          <Icon size={16} aria-hidden="true" />
                        </ThemeIcon>
                        <Text size="sm" c="gray.1">
                          {label as string}
                        </Text>
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            </Box>

            <Center h="100%" p={{ base: 'md', sm: 'xl' }}>
              <Stack w="100%" maw={430} gap="lg">
                <SegmentedControl
                  fullWidth
                  value={mode}
                  onChange={(value) =>
                    void navigate({
                      to: value === 'login' ? '/login' : '/signup',
                    })
                  }
                  data={[
                    { label: 'Sign in', value: 'login' },
                    { label: 'Create org', value: 'signup' },
                  ]}
                />

                <Paper withBorder radius="md" p="xl" shadow="sm">
                  <Stack gap="lg">
                    <Box>
                      <Title order={2} size="h2">
                        {mode === 'login'
                          ? 'Welcome back'
                          : 'Start a workspace'}
                      </Title>
                      <Text mt={4} size="sm" c="dimmed">
                        {mode === 'login'
                          ? 'Use your existing workspace credentials.'
                          : 'Create the first owner for a new organization.'}
                      </Text>
                    </Box>

                    {GOOGLE_CLIENT_ID ? (
                      <>
                        <Stack gap="xs">
                          <Box
                            ref={googleButtonRef}
                            style={{
                              minHeight: 44,
                              display: googleSignInMutation.isPending
                                ? 'none'
                                : undefined,
                            }}
                          />
                          {googleSignInMutation.isPending ? (
                            <Button
                              fullWidth
                              variant="default"
                              loading
                              leftSection={<Loader2 size={16} />}
                            >
                              Signing in with Google...
                            </Button>
                          ) : null}
                        </Stack>

                        {googleError ? (
                          <Alert
                            color={
                              googleError.includes('invitation') ||
                              googleError.includes('verified')
                                ? 'blue'
                                : 'red'
                            }
                            variant="light"
                          >
                            {googleError}
                          </Alert>
                        ) : null}

                        <Divider
                          label="or continue with email"
                          labelPosition="center"
                        />
                      </>
                    ) : null}

                    {mode === 'login' ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          loginMutation.mutate(loginForm);
                        }}
                      >
                        <Stack gap="md">
                          <TextInput
                            label="Email"
                            type="email"
                            autoComplete="email"
                            leftSection={<Mail size={16} />}
                            value={loginForm.email}
                            onChange={(event) =>
                              setLoginForm((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            required
                          />
                          <PasswordInput
                            label="Password"
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
                          <Text size="sm" ta="right">
                            <Text
                              component={Link}
                              to="/forgot-password"
                              c="blue"
                              inherit
                            >
                              Forgot password?
                            </Text>
                          </Text>
                          <SubmitButton pending={pending}>Sign in</SubmitButton>
                        </Stack>
                      </form>
                    ) : (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          signupMutation.mutate(signupForm);
                        }}
                      >
                        <Stack gap="md">
                          <TextInput
                            label="Organization"
                            leftSection={<Building2 size={16} />}
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
                          <TextInput
                            label="Full name"
                            value={signupForm.fullName}
                            onChange={(event) =>
                              setSignupForm((current) => ({
                                ...current,
                                fullName: event.target.value,
                              }))
                            }
                            required
                          />
                          <TextInput
                            label="Work email"
                            type="email"
                            autoComplete="email"
                            leftSection={<Mail size={16} />}
                            value={signupForm.email}
                            onChange={(event) =>
                              setSignupForm((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            required
                          />
                          <PasswordInput
                            label="Password"
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
                          <SubmitButton pending={pending}>
                            Create workspace
                          </SubmitButton>
                        </Stack>
                      </form>
                    )}

                    {activeError ? (
                      <Alert color="red" variant="light">
                        {activeError}
                      </Alert>
                    ) : null}
                  </Stack>
                </Paper>
              </Stack>
            </Center>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: string;
}) {
  return (
    <Button
      fullWidth
      type="submit"
      loading={pending}
      rightSection={pending ? <Loader2 size={16} /> : <ArrowRight size={16} />}
    >
      {children}
    </Button>
  );
}
