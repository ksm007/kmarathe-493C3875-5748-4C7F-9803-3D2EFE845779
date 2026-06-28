import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { CreateSprintRequest, Sprint } from '@nx-temp/data';
import { SprintState } from '@nx-temp/data';
import { Plus } from 'lucide-react';
import { apiClient } from '~/lib/api-client';
import { getStoredSession } from '~/lib/auth-storage';
import { formatError } from '~/lib/format';
import { queryClient } from '~/lib/query-client';
import { useCurrentUser } from '~/lib/use-current-user';

interface SprintFormState {
  name: string;
  goal: string;
  capacityPoints: number | '';
  startDate: string;
  endDate: string;
}

const emptySprintForm: SprintFormState = {
  name: '',
  goal: '',
  capacityPoints: '',
  startDate: '',
  endDate: '',
};

export const Route = createFileRoute('/_authed/_admin/sprints')({
  loader: () => {
    const organizationId = getStoredSession()?.user.organizationId;
    return queryClient.prefetchQuery({
      queryKey: ['sprints', organizationId],
      queryFn: () => apiClient.listSprints(),
    });
  },
  component: SprintsRoute,
});

function SprintsRoute() {
  const currentUser = useCurrentUser();
  const queryClientInstance = useQueryClient();
  const [form, setForm] = useState<SprintFormState>(emptySprintForm);

  const sprintsQuery = useQuery({
    queryKey: ['sprints', currentUser.organizationId],
    queryFn: () => apiClient.listSprints(),
  });

  const refreshSprints = async () => {
    await Promise.all([
      queryClientInstance.invalidateQueries({ queryKey: ['sprints'] }),
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: apiClient.createSprint,
    onSuccess: async () => {
      setForm(emptySprintForm);
      await refreshSprints();
    },
  });
  const startMutation = useMutation({
    mutationFn: apiClient.startSprint,
    onSuccess: refreshSprints,
  });
  const completeMutation = useMutation({
    mutationFn: ({
      id,
      destinationSprintId,
    }: {
      id: string;
      destinationSprintId?: string | null;
    }) => apiClient.completeSprint(id, { destinationSprintId }),
    onSuccess: refreshSprints,
  });

  const sprints = sprintsQuery.data ?? [];
  const plannedSprints = sprints.filter(
    (sprint) => sprint.state === SprintState.Planned,
  );
  const activeSprint = sprints.find(
    (sprint) => sprint.state === SprintState.Active,
  );
  const error = formatError(
    createMutation.error ??
      startMutation.error ??
      completeMutation.error ??
      sprintsQuery.error,
  );
  const pending =
    createMutation.isPending ||
    startMutation.isPending ||
    completeMutation.isPending;

  const submitSprint = () => {
    const payload: CreateSprintRequest = {
      name: form.name.trim(),
      goal: form.goal.trim() ? form.goal.trim() : null,
      capacityPoints: form.capacityPoints === '' ? null : form.capacityPoints,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    createMutation.mutate(payload);
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Box>
          <Title order={1}>Sprints</Title>
          <Text c="dimmed" mt={4}>
            {sprints.length} sprints,{' '}
            {activeSprint ? activeSprint.name : 'no active sprint'}
          </Text>
        </Box>
      </Group>

      <Paper withBorder radius="md" p="md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitSprint();
          }}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <TextInput
                label="Sprint name"
                maxLength={120}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
              />
              <NumberInput
                allowDecimal={false}
                allowNegative={false}
                label="Capacity points"
                min={0}
                value={form.capacityPoints}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    capacityPoints: typeof value === 'number' ? value : '',
                  }))
                }
              />
              <TextInput
                label="Start date"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
              />
              <TextInput
                label="End date"
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
              />
            </SimpleGrid>
            <Textarea
              autosize
              label="Goal"
              minRows={2}
              value={form.goal}
              onChange={(event) =>
                setForm((current) => ({ ...current, goal: event.target.value }))
              }
            />
            <Group justify="flex-end">
              <Button
                leftSection={<Plus size={16} />}
                loading={createMutation.isPending}
                type="submit"
              >
                Create sprint
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      {error ? <Alert color="red">{error}</Alert> : null}

      <Paper withBorder radius="md" p={0}>
        <Table.ScrollContainer minWidth={860}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>State</Table.Th>
                <Table.Th>Capacity</Table.Th>
                <Table.Th>Dates</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sprintsQuery.isPending ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Center py="lg">
                      <Loader size="sm" />
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : sprints.length ? (
                sprints.map((sprint) => (
                  <SprintRow
                    key={sprint.id}
                    pending={pending}
                    plannedSprints={plannedSprints}
                    sprint={sprint}
                    onComplete={(destinationSprintId) =>
                      completeMutation.mutate({
                        id: sprint.id,
                        destinationSprintId,
                      })
                    }
                    onStart={() => startMutation.mutate(sprint.id)}
                  />
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" py="md">
                      No sprints
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}

function SprintRow({
  pending,
  plannedSprints,
  sprint,
  onComplete,
  onStart,
}: {
  pending: boolean;
  plannedSprints: Sprint[];
  sprint: Sprint;
  onComplete: (destinationSprintId?: string | null) => void;
  onStart: () => void;
}) {
  const destinationOptions = plannedSprints
    .filter((plannedSprint) => plannedSprint.id !== sprint.id)
    .map((plannedSprint) => ({
      value: plannedSprint.id,
      label: plannedSprint.name,
    }));
  const [destinationSprintId, setDestinationSprintId] = useState<string | null>(
    null,
  );
  const stateColor: Record<SprintState, string> = {
    [SprintState.Planned]: 'blue',
    [SprintState.Active]: 'green',
    [SprintState.Completed]: 'gray',
  };

  return (
    <Table.Tr>
      <Table.Td>
        <Text fw={700} size="sm">
          {sprint.name}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {sprint.goal ?? 'No goal'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge color={stateColor[sprint.state]} variant="light">
          {sprint.state}
        </Badge>
      </Table.Td>
      <Table.Td>{sprint.capacityPoints ?? 'Unset'}</Table.Td>
      <Table.Td>
        {sprint.startDate ?? 'No start'} - {sprint.endDate ?? 'No end'}
      </Table.Td>
      <Table.Td>
        {sprint.state === SprintState.Planned ? (
          <Button size="compact-xs" disabled={pending} onClick={onStart}>
            Start
          </Button>
        ) : sprint.state === SprintState.Active ? (
          <Group gap="xs" wrap="nowrap">
            <Select
              clearable
              placeholder="Backlog"
              size="xs"
              w={160}
              data={destinationOptions}
              value={destinationSprintId}
              onChange={setDestinationSprintId}
            />
            <Button
              size="compact-xs"
              disabled={pending}
              onClick={() => onComplete(destinationSprintId)}
            >
              Complete
            </Button>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            Complete
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
