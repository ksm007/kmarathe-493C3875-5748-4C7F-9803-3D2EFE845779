import { useMemo, useState } from 'react';
import { Alert, Anchor, Button, PasswordInput, Stack } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ResetPasswordRequest } from '@nx-temp/data';
import { ArrowRight, KeyRound } from 'lucide-react';
import { AuthCard } from '~/components/auth-card';
import { apiClient, ApiClientError } from '~/lib/api-client';

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const navigate = Route.useNavigate();
  const { token = '' } = Route.useSearch();
  const [newPassword, setNewPassword] = useState('');
  const [completed, setCompleted] = useState(false);

  const resetMutation = useMutation({
    mutationFn: (payload: ResetPasswordRequest) =>
      apiClient.resetPassword(payload),
    onSuccess: () => {
      setCompleted(true);
      window.setTimeout(() => void navigate({ to: '/login' }), 1200);
    },
  });

  const error = useMemo(
    () =>
      resetMutation.error instanceof ApiClientError
        ? resetMutation.error.message
        : resetMutation.error
          ? 'Unable to reset password.'
          : '',
    [resetMutation.error],
  );

  return (
    <AuthCard
      icon={<KeyRound size={20} aria-hidden="true" />}
      title="Choose new password"
      subtitle="Reset links expire after 30 minutes and can only be used once."
    >
      {!token ? (
        <Alert color="red">This reset link is missing its token.</Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          resetMutation.mutate({ token, newPassword });
        }}
      >
        <Stack gap="md">
          <PasswordInput
            label="New password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          {completed ? (
            <Alert color="blue">
              Your password has been reset. Redirecting to sign in.
            </Alert>
          ) : null}
          {error ? <Alert color="red">{error}</Alert> : null}
          <Button
            disabled={!token || completed}
            loading={resetMutation.isPending}
            rightSection={<ArrowRight size={16} />}
            type="submit"
          >
            Reset password
          </Button>
        </Stack>
      </form>

      <Anchor component={Link} size="sm" to="/login">
        Go to login
      </Anchor>
    </AuthCard>
  );
}
