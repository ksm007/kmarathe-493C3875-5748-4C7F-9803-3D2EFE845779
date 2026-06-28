import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { createFileRoute } from '@tanstack/react-router';
import type {
  CreateInvitationRequest,
  InvitationResponse,
  UserSummary,
} from '@nx-temp/data';
import { Role } from '@nx-temp/data';
import { Mail, UserMinus, UserPlus } from 'lucide-react';
import { apiClient } from '~/lib/api-client';
import { getStoredSession } from '~/lib/auth-storage';
import { formatError } from '~/lib/format';
import { queryClient } from '~/lib/query-client';
import { useCurrentUser } from '~/lib/use-current-user';

export const Route = createFileRoute('/_authed/team')({
  loader: () => {
    const organizationId = getStoredSession()?.user.organizationId;
    return queryClient.prefetchQuery({
      queryKey: ['team-users', organizationId],
      queryFn: apiClient.listUsers,
    });
  },
  component: TeamRoute,
});

function TeamRoute() {
  const currentUser = useCurrentUser();
  const queryClientInstance = useQueryClient();
  const canManageTeam =
    currentUser.role === Role.Owner || currentUser.role === Role.Admin;
  const roleOptions = [
    ...(currentUser.role === Role.Owner
      ? [{ value: Role.Owner, label: 'Owner' }]
      : []),
    { value: Role.Admin, label: 'Admin' },
    { value: Role.Viewer, label: 'Viewer' },
  ];

  const usersQuery = useQuery({
    queryKey: ['team-users', currentUser.organizationId],
    queryFn: apiClient.listUsers,
  });
  const invitationsQuery = useQuery({
    queryKey: ['invitations', currentUser.organizationId],
    queryFn: apiClient.listInvitations,
    enabled: canManageTeam,
  });

  const refreshTeam = async () => {
    await Promise.all([
      queryClientInstance.invalidateQueries({ queryKey: ['team-users'] }),
      queryClientInstance.invalidateQueries({ queryKey: ['invitations'] }),
    ]);
  };

  const inviteMutation = useMutation({
    mutationFn: apiClient.createInvitation,
    onSuccess: async () => {
      inviteForm.reset();
      await refreshTeam();
    },
  });
  const removeMutation = useMutation({
    mutationFn: apiClient.removeUser,
    onSuccess: refreshTeam,
  });

  const inviteForm = useForm({
    defaultValues: {
      email: '',
      role: Role.Viewer as Role,
    },
    onSubmit: async ({ value }) => {
      const payload: CreateInvitationRequest = {
        email: value.email.trim(),
        role: value.role,
      };
      inviteMutation.mutate(payload);
    },
  });

  const users = usersQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const pending = inviteMutation.isPending || removeMutation.isPending;
  const actionError = formatError(inviteMutation.error ?? removeMutation.error);

  const removeUser = (user: UserSummary) => {
    if (
      window.confirm(
        `Remove ${user.fullName} from ${currentUser.organizationName}?`,
      )
    ) {
      removeMutation.mutate(user.id);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Box>
          <Title order={1}>Team</Title>
          <Text c="dimmed" mt={4}>
            {users.length} members in {currentUser.organizationName}
          </Text>
        </Box>
      </Group>

      {canManageTeam ? (
        <Paper withBorder radius="md" p="md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void inviteForm.handleSubmit();
            }}
          >
            <Group align="flex-end" gap="md" wrap="wrap">
              <inviteForm.Field
                name="email"
                validators={{
                  onSubmit: ({ value }) =>
                    !value.trim() ? 'Email is required' : undefined,
                }}
              >
                {(field) => (
                  <TextInput
                    label="Invite email"
                    type="email"
                    leftSection={<Mail size={16} />}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors[0]}
                    required
                    style={{ flex: 1, minWidth: 200 }}
                  />
                )}
              </inviteForm.Field>
              <inviteForm.Field name="role">
                {(field) => (
                  <Select
                    allowDeselect={false}
                    data={roleOptions}
                    label="Role"
                    value={field.state.value}
                    onChange={(role) => field.handleChange(role as Role)}
                    style={{ minWidth: 130 }}
                  />
                )}
              </inviteForm.Field>
              <Button
                leftSection={<UserPlus size={16} />}
                loading={inviteMutation.isPending}
                mb={actionError ? undefined : 0}
                type="submit"
              >
                Invite
              </Button>
            </Group>
          </form>
          {actionError ? (
            <Alert color="red" mt="md">
              {actionError}
            </Alert>
          ) : null}
        </Paper>
      ) : null}

      {usersQuery.isError ? (
        <Alert color="red">{formatError(usersQuery.error)}</Alert>
      ) : null}

      <Paper withBorder radius="md" p={0}>
        <Table.ScrollContainer minWidth={720}>
          {usersQuery.isPending ? (
            <Center py="lg">
              <Loader size="sm" />
            </Center>
          ) : (
            <TeamMembersTable
              users={users}
              currentUser={currentUser}
              canManageTeam={canManageTeam}
              pending={pending}
              onRemove={removeUser}
            />
          )}
        </Table.ScrollContainer>
      </Paper>

      {canManageTeam ? (
        <Paper withBorder radius="md" p={0}>
          <Box p="md" pb={0}>
            <Text fw={800}>Invitations</Text>
          </Box>
          {invitationsQuery.isError ? (
            <Alert color="red" m="md">
              {formatError(invitationsQuery.error)}
            </Alert>
          ) : null}
          <Table.ScrollContainer minWidth={680}>
            {invitationsQuery.isPending ? (
              <Center py="lg">
                <Loader size="sm" />
              </Center>
            ) : (
              <InvitationsTable invitations={invitations} />
            )}
          </Table.ScrollContainer>
        </Paper>
      ) : null}
    </Stack>
  );
}

const userColumnHelper = createColumnHelper<UserSummary>();

function TeamMembersTable({
  users,
  currentUser,
  canManageTeam,
  pending,
  onRemove,
}: {
  users: UserSummary[];
  currentUser: { id: string; role: Role; organizationName: string };
  canManageTeam: boolean;
  pending: boolean;
  onRemove: (user: UserSummary) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      userColumnHelper.accessor('fullName', {
        header: 'Name',
        cell: (info) => (
          <Text fw={700} size="sm">
            {info.getValue()}
          </Text>
        ),
      }),
      userColumnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => info.getValue(),
      }),
      userColumnHelper.accessor('role', {
        header: 'Role',
        cell: (info) => <Badge variant="light">{info.getValue()}</Badge>,
      }),
      userColumnHelper.accessor('organizationName', {
        header: 'Organization',
        cell: (info) => info.getValue(),
      }),
      userColumnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const user = info.row.original;
          return (
            <Button
              color="red"
              disabled={
                !canManageTeam ||
                user.id === currentUser.id ||
                pending ||
                (currentUser.role === Role.Admin && user.role === Role.Owner)
              }
              leftSection={<UserMinus size={14} />}
              size="compact-xs"
              variant="subtle"
              title={
                currentUser.role === Role.Admin && user.role === Role.Owner
                  ? 'Admins cannot remove Owners'
                  : undefined
              }
              onClick={() => onRemove(user)}
            >
              Remove
            </Button>
          );
        },
      }),
    ],
    [canManageTeam, currentUser.id, currentUser.role, pending, onRemove],
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table verticalSpacing="sm">
      <Table.Thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Table.Th
                key={header.id}
                style={
                  header.column.getCanSort()
                    ? { cursor: 'pointer', userSelect: 'none' }
                    : undefined
                }
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
                {header.column.getIsSorted() === 'asc'
                  ? ' ↑'
                  : header.column.getIsSorted() === 'desc'
                    ? ' ↓'
                    : null}
              </Table.Th>
            ))}
          </Table.Tr>
        ))}
      </Table.Thead>
      <Table.Tbody>
        {table.getRowModel().rows.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text c="dimmed" py="md">
                No team members
              </Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          table.getRowModel().rows.map((row) => (
            <Table.Tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.Td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Td>
              ))}
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
}

const invitationColumnHelper = createColumnHelper<InvitationResponse>();

function InvitationsTable({
  invitations,
}: {
  invitations: InvitationResponse[];
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const statusColor: Record<InvitationResponse['status'], string> = {
    pending: 'blue',
    accepted: 'green',
    expired: 'gray',
  };

  const columns = useMemo(
    () => [
      invitationColumnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => info.getValue(),
      }),
      invitationColumnHelper.accessor('role', {
        header: 'Role',
        cell: (info) => <Badge variant="light">{info.getValue()}</Badge>,
      }),
      invitationColumnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Badge color={statusColor[info.getValue()]} variant="light">
            {info.getValue()}
          </Badge>
        ),
      }),
      invitationColumnHelper.accessor('expiresAt', {
        header: 'Expires',
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: invitations,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table verticalSpacing="sm">
      <Table.Thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Table.Th
                key={header.id}
                style={
                  header.column.getCanSort()
                    ? { cursor: 'pointer', userSelect: 'none' }
                    : undefined
                }
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
                {header.column.getIsSorted() === 'asc'
                  ? ' ↑'
                  : header.column.getIsSorted() === 'desc'
                    ? ' ↓'
                    : null}
              </Table.Th>
            ))}
          </Table.Tr>
        ))}
      </Table.Thead>
      <Table.Tbody>
        {table.getRowModel().rows.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Text c="dimmed" py="md">
                No invitations
              </Text>
            </Table.Td>
          </Table.Tr>
        ) : (
          table.getRowModel().rows.map((row) => (
            <Table.Tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.Td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Td>
              ))}
            </Table.Tr>
          ))
        )}
      </Table.Tbody>
    </Table>
  );
}
