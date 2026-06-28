import { createFileRoute, redirect } from '@tanstack/react-router';
import { AuthLanding } from '~/features/auth/auth-landing';
import { getStoredSession } from '~/lib/auth-storage';

export const Route = createFileRoute('/signup')({
  // Client-only so the "already signed in" check can read localStorage; on the
  // server the session is invisible and the guard would never fire.
  ssr: false,
  beforeLoad: () => {
    if (getStoredSession()) {
      throw redirect({ to: '/tasks' });
    }
  },
  component: () => <AuthLanding mode="signup" />,
});
