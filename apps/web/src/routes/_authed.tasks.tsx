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
  RingProgress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import type {
  CreateTaskRequest,
  Sprint,
  Task,
  TaskQuery,
  UpdateTaskRequest,
} from '@nx-temp/data';
import {
  IssueType,
  SprintState,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import { Plus, Search } from 'lucide-react';
import { apiClient } from '~/lib/api-client';
import { formatError } from '~/lib/format';
import { queryClient } from '~/lib/query-client';
import { useCurrentUser } from '~/lib/use-current-user';
import {
  TaskBoard,
  TaskList,
  groupTasksByStatus,
  mergeReorderedTasks,
  mergeTasks,
  statusColumns,
} from '~/features/tasks/board';
import { TaskFormModal, emptyTaskForm } from '~/features/tasks/task-form-modal';
import type { TaskFormState } from '~/features/tasks/task-form-modal';

type ViewMode = 'board' | 'list' | 'analytics';

const defaultTaskFilters: TaskQuery = { sortBy: 'position', order: 'asc' };

export const Route = createFileRoute('/_authed/tasks')({
  loader: () =>
    queryClient.prefetchQuery({
      queryKey: ['tasks', defaultTaskFilters],
      queryFn: () => apiClient.listTasks(defaultTaskFilters),
    }),
  component: TasksRoute,
});

function TasksRoute() {
  const navigate = useNavigate();
  const queryClientInstance = useQueryClient();
  const user = useCurrentUser();
  const [filters, setFilters] = useState<TaskQuery>(defaultTaskFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormDefaults, setTaskFormDefaults] =
    useState<TaskFormState>(emptyTaskForm);

  const tasksQuery = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => apiClient.listTasks(filters),
  });
  const sprintsQuery = useQuery({
    queryKey: ['sprints-all'],
    queryFn: () => apiClient.listSprints(),
  });
  const taskFormOptionsQuery = useQuery({
    queryKey: ['task-form-options', user.organizationId],
    queryFn: async () => {
      const [users, sprints, taskOptions] = await Promise.all([
        apiClient.listUsers(),
        apiClient.listSprints(),
        apiClient.listTasks({ sortBy: 'title', order: 'asc' }),
      ]);

      return { users, sprints, taskOptions };
    },
    enabled: taskFormOpen,
  });

  const tasks = tasksQuery.data ?? [];
  const sprints = sprintsQuery.data ?? [];
  const taskFormOptions = taskFormOptionsQuery.data;
  const assignableUsers = taskFormOptions?.users ?? [];
  const assignableSprints =
    taskFormOptions?.sprints.filter(
      (sprint) => sprint.state !== SprintState.Completed,
    ) ?? [];
  const epicOptions =
    taskFormOptions?.taskOptions.filter(
      (task) =>
        task.issueType === IssueType.Epic && task.id !== editingTask?.id,
    ) ?? [];
  const groupedTasks = useMemo(() => groupTasksByStatus(tasks), [tasks]);
  const canReorderTasks =
    viewMode === 'board' &&
    (filters.sortBy ?? 'position') === 'position' &&
    (filters.order ?? 'asc') === 'asc' &&
    !filters.search &&
    !filters.category &&
    !filters.status;
  const activeTasks = tasks.filter(
    (task) => task.status !== TaskStatus.Done,
  ).length;

  const refreshTasks = async () => {
    await queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
  };

  const createTaskMutation = useMutation({
    mutationFn: apiClient.createTask,
    onSuccess: async () => {
      closeTaskForm();
      await refreshTasks();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTaskRequest }) =>
      apiClient.updateTask(id, payload),
    onSuccess: async () => {
      closeTaskForm();
      await refreshTasks();
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: apiClient.deleteTask,
    onSuccess: async () => {
      closeTaskForm();
      await refreshTasks();
    },
  });
  const reorderTasksMutation = useMutation({
    mutationFn: apiClient.reorderTasks,
    onMutate: async (payload) => {
      await queryClientInstance.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClientInstance.getQueryData<Task[]>([
        'tasks',
        filters,
      ]);
      queryClientInstance.setQueryData<Task[]>(
        ['tasks', filters],
        (current = []) => mergeReorderedTasks(current, payload),
      );

      return { previousTasks };
    },
    onSuccess: (updatedTasks) => {
      queryClientInstance.setQueryData<Task[]>(
        ['tasks', filters],
        (current = []) => mergeTasks(current, updatedTasks),
      );
      notifications.show({
        color: 'green',
        message: 'Task order and status were saved.',
        title: 'Board updated',
      });
    },
    onError: (error, _payload, context) => {
      if (context?.previousTasks) {
        queryClientInstance.setQueryData(
          ['tasks', filters],
          context.previousTasks,
        );
      }
      notifications.show({
        color: 'red',
        message: formatError(error),
        title: 'Reorder failed',
      });
    },
  });
  const mutationError = formatError(
    createTaskMutation.error ??
      updateTaskMutation.error ??
      deleteTaskMutation.error,
  );
  const mutationPending =
    createTaskMutation.isPending ||
    updateTaskMutation.isPending ||
    deleteTaskMutation.isPending;

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskFormDefaults(emptyTaskForm);
    setTaskFormOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskFormDefaults({
      title: task.title,
      description: task.description ?? '',
      issueType: task.issueType,
      category: task.category,
      priority: task.priority,
      status: task.status,
      storyPoints: task.storyPoints ?? '',
      sprintId: task.sprintId ?? '',
      parentEpicId: task.parentEpicId ?? '',
      assigneeId: task.assigneeId ?? '',
      dueDate: task.dueDate ?? '',
      tagsText: task.tags.join(', '),
      acceptanceCriteriaText: task.acceptanceCriteria
        .map((item) => item.text)
        .join('\n'),
    });
    setTaskFormOpen(true);
  };

  const closeTaskForm = () => {
    setTaskFormOpen(false);
    setEditingTask(null);
    setTaskFormDefaults(emptyTaskForm);
  };

  const saveTask = (payload: CreateTaskRequest) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, payload });
      return;
    }

    createTaskMutation.mutate(payload);
  };

  const deleteTask = (task: Task) => {
    if (window.confirm(`Delete "${task.title}"?`)) {
      deleteTaskMutation.mutate(task.id);
    }
  };

  const openDetails = (task: Task) => {
    void navigate({ to: '/tasks/$id', params: { id: task.id } });
  };

  return (
    <>
      <TaskFormModal
        key={editingTask?.id ?? 'new'}
        assignableUsers={assignableUsers}
        editingTask={editingTask}
        epicOptions={epicOptions}
        error={mutationError}
        defaultValues={taskFormDefaults}
        mode={editingTask ? 'edit' : 'create'}
        onClose={closeTaskForm}
        onDelete={editingTask ? () => deleteTask(editingTask) : undefined}
        onSave={saveTask}
        opened={taskFormOpen}
        pending={mutationPending}
        sprintOptions={assignableSprints}
      />
      <Outlet />
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Title order={1}>Task Workspace</Title>
            <Text c="dimmed" mt={4}>
              {tasks.length} tracked tasks, {activeTasks} active items
            </Text>
          </Box>
          <Group gap="sm">
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              data={[
                { label: 'Board', value: 'board' },
                { label: 'List', value: 'list' },
                { label: 'Analytics', value: 'analytics' },
              ]}
            />
            <Button leftSection={<Plus size={16} />} onClick={openCreateTask}>
              New task
            </Button>
          </Group>
        </Group>

        <Paper withBorder radius="md" p="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <TextInput
              label="Search"
              placeholder="Title, description, tag"
              leftSection={<Search size={16} />}
              value={filters.search ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value || undefined,
                }))
              }
            />
            <Select
              label="Category"
              placeholder="All categories"
              clearable
              data={[
                { value: TaskCategory.Work, label: 'Work' },
                { value: TaskCategory.Personal, label: 'Personal' },
                { value: TaskCategory.Ops, label: 'Ops' },
              ]}
              value={filters.category ?? null}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  category: (value as TaskCategory | null) ?? undefined,
                }))
              }
            />
            <Select
              label="Status"
              placeholder="All statuses"
              clearable
              data={statusColumns.map((column) => ({
                value: column.status,
                label: column.label,
              }))}
              value={filters.status ?? null}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  status: (value as TaskStatus | null) ?? undefined,
                }))
              }
            />
            <Select
              label="Sprint"
              placeholder="All sprints"
              clearable
              data={[
                { value: 'backlog', label: 'Backlog (no sprint)' },
                ...sprints.map((s: Sprint) => ({
                  value: s.id,
                  label: s.name,
                })),
              ]}
              value={filters.sprintId ?? null}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  sprintId: value ?? undefined,
                }))
              }
            />
            <Select
              label="Sort"
              data={[
                { value: 'position', label: 'Board order' },
                { value: 'updatedAt', label: 'Recently updated' },
                { value: 'title', label: 'Title' },
                { value: 'priority', label: 'Priority' },
              ]}
              value={filters.sortBy ?? 'position'}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  sortBy: (value as TaskQuery['sortBy'] | null) ?? 'position',
                }))
              }
            />
          </SimpleGrid>
        </Paper>

        {tasksQuery.isError ? (
          <Alert color="red">{formatError(tasksQuery.error)}</Alert>
        ) : null}

        {tasksQuery.isPending ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : viewMode === 'analytics' ? (
          <TaskAnalyticsView tasks={tasks} />
        ) : viewMode === 'board' ? (
          <Stack gap="sm">
            {!canReorderTasks ? (
              <Text size="sm" c="dimmed">
                Switch to board order and clear filters to drag tasks.
              </Text>
            ) : null}
            <TaskBoard
              canReorder={canReorderTasks}
              groupedTasks={groupedTasks}
              reorderPending={reorderTasksMutation.isPending}
              onDelete={deleteTask}
              onEdit={openEditTask}
              onOpenDetails={openDetails}
              onReorder={(payload) => reorderTasksMutation.mutate(payload)}
            />
          </Stack>
        ) : (
          <TaskList
            tasks={tasks}
            onDelete={deleteTask}
            onEdit={openEditTask}
            onOpenDetails={openDetails}
          />
        )}
      </Stack>
    </>
  );
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TaskPriority.Low]: 'var(--mantine-color-gray-6)',
  [TaskPriority.Medium]: 'var(--mantine-color-blue-6)',
  [TaskPriority.High]: 'var(--mantine-color-red-6)',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.Backlog]: 'gray',
  [TaskStatus.Todo]: 'blue',
  [TaskStatus.InProgress]: 'yellow',
  [TaskStatus.InReview]: 'violet',
  [TaskStatus.Done]: 'green',
};

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap={4}>
        <Text size="xs" fw={600} tt="uppercase" c="dimmed">
          {label}
        </Text>
        <Text size="2rem" fw={800} c={color}>
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

function PriorityBar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <Group gap="sm" wrap="nowrap" align="center">
      <Text size="sm" w={60} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Box
        style={{
          flex: 1,
          background: 'var(--mantine-color-gray-1)',
          borderRadius: 4,
          height: 20,
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>
      <Badge variant="light" size="sm" style={{ flexShrink: 0, minWidth: 32 }}>
        {count}
      </Badge>
    </Group>
  );
}

function TaskAnalyticsView({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === TaskStatus.Done).length;
  const active = tasks.filter(
    (t) => t.status !== TaskStatus.Done && t.status !== TaskStatus.Backlog,
  ).length;
  const backlog = tasks.filter((t) => t.status === TaskStatus.Backlog).length;
  const donePercent = total === 0 ? 0 : Math.round((done / total) * 100);

  const byPriority = [
    {
      label: 'High',
      count: tasks.filter((t) => t.priority === TaskPriority.High).length,
      color: PRIORITY_COLORS[TaskPriority.High],
    },
    {
      label: 'Medium',
      count: tasks.filter((t) => t.priority === TaskPriority.Medium).length,
      color: PRIORITY_COLORS[TaskPriority.Medium],
    },
    {
      label: 'Low',
      count: tasks.filter((t) => t.priority === TaskPriority.Low).length,
      color: PRIORITY_COLORS[TaskPriority.Low],
    },
  ];
  const maxPriorityCount = Math.max(...byPriority.map((p) => p.count), 1);

  const byStatus = statusColumns.map((col) => ({
    label: col.label,
    count: tasks.filter((t) => t.status === col.status).length,
    color: STATUS_COLORS[col.status],
  }));
  const maxStatusCount = Math.max(...byStatus.map((s) => s.count), 1);

  const byCategory = [
    {
      label: 'Work',
      count: tasks.filter((t) => t.category === TaskCategory.Work).length,
    },
    {
      label: 'Personal',
      count: tasks.filter((t) => t.category === TaskCategory.Personal).length,
    },
    {
      label: 'Ops',
      count: tasks.filter((t) => t.category === TaskCategory.Ops).length,
    },
  ];

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <StatCard label="Total tasks" value={total} color="dark" />
        <StatCard label="Active" value={active} color="yellow" />
        <StatCard label="Done" value={done} color="green" />
        <StatCard label="Backlog" value={backlog} color="gray" />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Text fw={700}>Completion</Text>
            <Center>
              <RingProgress
                size={120}
                thickness={14}
                sections={[{ value: donePercent, color: 'green' }]}
                label={
                  <Center>
                    <Stack gap={0} align="center">
                      <Text fw={800} size="lg">
                        {donePercent}%
                      </Text>
                      <Text size="xs" c="dimmed">
                        done
                      </Text>
                    </Stack>
                  </Center>
                }
              />
            </Center>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Text fw={700}>By Priority</Text>
            <Stack gap="sm">
              {byPriority.map((p) => (
                <PriorityBar
                  key={p.label}
                  label={p.label}
                  count={p.count}
                  max={maxPriorityCount}
                  color={p.color}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Text fw={700}>By Status</Text>
            <Stack gap="sm">
              {byStatus.map((s) => (
                <PriorityBar
                  key={s.label}
                  label={s.label}
                  count={s.count}
                  max={maxStatusCount}
                  color={`var(--mantine-color-${s.color}-6)`}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="md" p="lg">
        <Stack gap="md">
          <Text fw={700}>By Category</Text>
          <Group gap="md">
            {byCategory.map((c) => (
              <Paper
                key={c.label}
                withBorder
                radius="md"
                p="md"
                style={{ flex: 1, minWidth: 100 }}
              >
                <Stack gap={4} align="center">
                  <Text size="sm" c="dimmed">
                    {c.label}
                  </Text>
                  <Text fw={800} size="xl">
                    {c.count}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
