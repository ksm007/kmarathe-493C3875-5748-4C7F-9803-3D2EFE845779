import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Select,
  Title,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

interface InvitationFormState {
  email: string;
  role: Role;
}

const emptyInvitationForm: InvitationFormState = {
  email: '',
  role: Role.Viewer,
};

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
  const [inviteForm, setInviteForm] =
    useState<InvitationFormState>(emptyInvitationForm);
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
      setInviteForm(emptyInvitationForm);
      await refreshTeam();
    },
  });
  const removeMutation = useMutation({
    mutationFn: apiClient.removeUser,
    onSuccess: refreshTeam,
  });

  const users = usersQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const pending = inviteMutation.isPending || removeMutation.isPending;
  const actionError = formatError(inviteMutation.error ?? removeMutation.error);

  const submitInvite = () => {
    const payload: CreateInvitationRequest = {
      email: inviteForm.email.trim(),
      role: inviteForm.role,
    };
    inviteMutation.mutate(payload);
  };

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
              submitInvite();
            }}
          >
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <TextInput
                label="Invite email"
                type="email"
                leftSection={<Mail size={16} />}
                value={inviteForm.email}
                onChange={(event) =>
                  setInviteForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                required
              />
              <Select
                allowDeselect={false}
                data={roleOptions}
                label="Role"
                value={inviteForm.role}
                onChange={(role) =>
                  setInviteForm((current) => ({
                    ...current,
                    role: role as Role,
                  }))
                }
              />
              <Button
                leftSection={<UserPlus size={16} />}
                loading={inviteMutation.isPending}
                mt={{ base: 0, md: 25 }}
                type="submit"
              >
                Invite
              </Button>
            </SimpleGrid>
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
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Organization</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {usersQuery.isPending ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Center py="lg">
                      <Loader size="sm" />
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : (
                users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Text fw={700} size="sm">
                        {user.fullName}
                      </Text>
                    </Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{user.role}</Badge>
                    </Table.Td>
                    <Table.Td>{user.organizationName}</Table.Td>
                    <Table.Td>
                      <Button
                        color="red"
                        disabled={
                          !canManageTeam ||
                          user.id === currentUser.id ||
                          pending
                        }
                        leftSection={<UserMinus size={14} />}
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => removeUser(user)}
                      >
                        Remove
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
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
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Expires</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invitationsQuery.isPending ? (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Center py="lg">
                        <Loader size="sm" />
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : invitations.length ? (
                  invitations.map((invitation) => (
                    <InvitationRow
                      key={invitation.id}
                      invitation={invitation}
                    />
                  ))
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text c="dimmed" py="md">
                        No invitations
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      ) : null}
    </Stack>
  );
}

function InvitationRow({ invitation }: { invitation: InvitationResponse }) {
  const statusColor: Record<InvitationResponse['status'], string> = {
    pending: 'blue',
    accepted: 'green',
    expired: 'gray',
  };

  return (
    <Table.Tr>
      <Table.Td>{invitation.email}</Table.Td>
      <Table.Td>
        <Badge variant="light">{invitation.role}</Badge>
      </Table.Td>
      <Table.Td>
        <Badge color={statusColor[invitation.status]} variant="light">
          {invitation.status}
        </Badge>
      </Table.Td>
      <Table.Td>{new Date(invitation.expiresAt).toLocaleDateString()}</Table.Td>
    </Table.Tr>
  );
}
