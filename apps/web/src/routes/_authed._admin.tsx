import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Role } from '@nx-temp/data';
import { getStoredSession } from '~/lib/auth-storage';

/**
 * Admin-only guard layout nested under `/_authed`. Owners and admins may pass;
 * everyone else is redirected to the task board. Wraps the admin-only areas
 * (sprints, audit log) that were previously gated inline with a role check.
 */
export const Route = createFileRoute('/_authed/_admin')({
  beforeLoad: () => {
    const role = getStoredSession()?.user.role;
    if (role !== Role.Owner && role !== Role.Admin) {
      throw redirect({ to: '/tasks' });
    }
  },
  component: () => <Outlet />,
});
