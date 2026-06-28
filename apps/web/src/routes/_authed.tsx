import {
  Alert,
  Box,
  Button,
  Group,
  Select,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import {
  ClipboardList,
  FileText,
  Flag,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { ComponentType } from 'react';
import { apiClient } from '~/lib/api-client';
import {
  clearSession,
  getStoredSession,
  saveSession,
} from '~/lib/auth-storage';
import { formatError } from '~/lib/format';
import { useCurrentUser } from '~/lib/use-current-user';

/**
 * Authenticated layout. Runs client-only (`ssr: false`) because the session
 * lives in `localStorage`, which is unavailable during SSR. The `beforeLoad`
 * guard replaces the old localStorage `useEffect` gate: it redirects to
 * `/login` when no session is present and otherwise exposes the signed-in user
 * to child routes via route context.
 */
export const Route = createFileRoute('/_authed')({
  ssr: false,
  beforeLoad: () => {
    const session = getStoredSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }

    return { user: session.user };
  },
  component: AuthedLayout,
});

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const navItems: NavItem[] = [
  { to: '/tasks', label: 'Tasks', icon: LayoutDashboard },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/sprints', label: 'Sprints', icon: Flag },
  { to: '/ai-chat', label: 'AI chat', icon: Sparkles },
  { to: '/reports/standup', label: 'Reports', icon: FileText },
  { to: '/audit-log', label: 'Audit', icon: ScrollText },
];

function AuthedLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [orgSwitchError, setOrgSwitchError] = useState('');

  const organizationOptions = user.memberships.map((membership) => ({
    value: membership.organizationId,
    label: membership.organizationName,
  }));

  const switchOrgMutation = useMutation({
    mutationFn: apiClient.switchOrg,
    onMutate: () => setOrgSwitchError(''),
    onSuccess: async (session) => {
      saveSession(session);
      queryClient.setQueryData(['me'], session.user);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['task-form-options'] }),
        queryClient.invalidateQueries({ queryKey: ['team-users'] }),
        queryClient.invalidateQueries({ queryKey: ['invitations'] }),
        queryClient.invalidateQueries({ queryKey: ['sprints'] }),
        queryClient.invalidateQueries({ queryKey: ['chat-history'] }),
        queryClient.invalidateQueries({ queryKey: ['standup-report'] }),
        queryClient.invalidateQueries({ queryKey: ['audit-log'] }),
      ]);
    },
    onError: (error) => setOrgSwitchError(formatError(error)),
  });

  const signOut = () => {
    clearSession();
    queryClient.clear();
    void navigate({ to: '/login' });
  };

  return (
    <Box className="workspace-page">
      <Box className="workspace-shell">
        <Box component="aside" className="workspace-sidebar">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={38} radius="md" color="blue">
              <ClipboardList size={20} aria-hidden="true" />
            </ThemeIcon>
            <Box>
              <Text size="sm" fw={800}>
                Turbo Vets
              </Text>
              <Text size="xs" c="dimmed">
                {user.organizationName}
              </Text>
            </Box>
          </Group>

          <Stack gap={8}>
            <Select
              allowDeselect={false}
              data={organizationOptions}
              disabled={
                organizationOptions.length <= 1 || switchOrgMutation.isPending
              }
              label="Organization"
              value={user.organizationId}
              onChange={(organizationId) => {
                if (organizationId && organizationId !== user.organizationId) {
                  switchOrgMutation.mutate({ organizationId });
                }
              }}
            />
            {orgSwitchError ? (
              <Alert color="red" p="xs">
                {orgSwitchError}
              </Alert>
            ) : null}
          </Stack>

          <Stack gap={6}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.to);
              return (
                <Button
                  key={item.to}
                  component={Link}
                  to={item.to}
                  justify="flex-start"
                  variant={active ? 'light' : 'subtle'}
                  color={active ? 'blue' : 'gray'}
                  leftSection={<Icon size={16} />}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          <Box mt="auto">
            <Text size="xs" c="dimmed" mb={6}>
              Signed in as
            </Text>
            <Text size="sm" fw={700}>
              {user.fullName}
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              {user.role}
            </Text>
            <Button
              fullWidth
              variant="default"
              leftSection={<LogOut size={16} />}
              onClick={signOut}
            >
              Sign out
            </Button>
          </Box>
        </Box>

        <Box component="main" className="workspace-main">
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
