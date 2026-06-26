import { useMemo, useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { AcceptInvitationRequest } from '@nx-temp/data';
import { ArrowRight, UserPlus } from 'lucide-react';
import { AuthCard } from '~/components/auth-card';
import { apiClient, ApiClientError } from '~/lib/api-client';
import { saveSession } from '~/lib/auth-storage';

export const Route = createFileRoute('/accept-invite')({
  validateSearch: (search): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
  const navigate = Route.useNavigate();
  const { token = '' } = Route.useSearch();
  const [form, setForm] = useState<Omit<AcceptInvitationRequest, 'token'>>({
    fullName: '',
    password: '',
  });

  const acceptMutation = useMutation({
    mutationFn: (payload: AcceptInvitationRequest) =>
      apiClient.acceptInvitation(payload),
    onSuccess: async (session) => {
      saveSession(session);
      await navigate({ to: '/' });
    },
  });

  const error = useMemo(
    () =>
      acceptMutation.error instanceof ApiClientError
        ? acceptMutation.error.message
        : acceptMutation.error
          ? 'Unable to accept this invite.'
          : '',
    [acceptMutation.error],
  );

  return (
    <AuthCard
      icon={<UserPlus size={20} aria-hidden="true" />}
      title="Accept invitation"
      subtitle="Create your account to join the workspace."
    >
      {!token ? (
        <Alert color="red">This invite link is missing its token.</Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          acceptMutation.mutate({ token, ...form });
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Full name"
            minLength={2}
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            required
          />
          <PasswordInput
            label="Password"
            minLength={8}
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            required
          />
          {error ? <Alert color="red">{error}</Alert> : null}
          <Button
            disabled={!token}
            loading={acceptMutation.isPending}
            rightSection={<ArrowRight size={16} />}
            type="submit"
          >
            Join workspace
          </Button>
        </Stack>
      </form>

      <Anchor component={Link} size="sm" to="/">
        Already have an account?
      </Anchor>
    </AuthCard>
  );
}
