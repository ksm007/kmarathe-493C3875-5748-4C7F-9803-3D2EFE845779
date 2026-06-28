import { useMemo, useState } from 'react';
import { Alert, Anchor, Button, Stack, TextInput } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ForgotPasswordRequest } from '@nx-temp/data';
import { Mail, Send } from 'lucide-react';
import { AuthCard } from '~/components/auth-card';
import { apiClient, ApiClientError } from '~/lib/api-client';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const [form, setForm] = useState<ForgotPasswordRequest>({ email: '' });
  const [sent, setSent] = useState(false);

  const forgotMutation = useMutation({
    mutationFn: apiClient.forgotPassword,
    onSuccess: () => setSent(true),
  });

  const error = useMemo(
    () =>
      forgotMutation.error instanceof ApiClientError
        ? forgotMutation.error.message
        : forgotMutation.error
          ? 'Unable to request a reset link.'
          : '',
    [forgotMutation.error],
  );

  return (
    <AuthCard
      icon={<Mail size={20} aria-hidden="true" />}
      title="Reset password"
      subtitle="Enter your work email and we will send a reset link if the account exists."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSent(false);
          forgotMutation.mutate(form);
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Corporate email"
            leftSection={<Mail size={16} />}
            type="email"
            value={form.email}
            onChange={(event) => setForm({ email: event.target.value })}
            required
          />
          {sent ? (
            <Alert color="blue">
              If that account exists, a reset link has been sent.
            </Alert>
          ) : null}
          {error ? <Alert color="red">{error}</Alert> : null}
          <Button
            loading={forgotMutation.isPending}
            leftSection={<Send size={16} />}
            type="submit"
          >
            Send reset link
          </Button>
        </Stack>
      </form>

      <Anchor component={Link} size="sm" to="/login">
        Remembered your password?
      </Anchor>
    </AuthCard>
  );
}
