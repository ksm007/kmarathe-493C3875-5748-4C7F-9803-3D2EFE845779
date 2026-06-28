import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Paper,
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
  Task,
  TaskQuery,
  UpdateTaskRequest,
} from '@nx-temp/data';
import {
  IssueType,
  SprintState,
  TaskCategory,
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
import {
  TaskFormModal,
  emptyTaskForm,
  taskFormToPayload,
} from '~/features/tasks/task-form-modal';
import type { TaskFormState } from '~/features/tasks/task-form-modal';

type ViewMode = 'board' | 'list';

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
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm);

  const tasksQuery = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => apiClient.listTasks(filters),
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
    setTaskForm(emptyTaskForm);
    setTaskFormOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
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
    setTaskForm(emptyTaskForm);
  };

  const saveTask = () => {
    const payload = taskFormToPayload(taskForm, editingTask);
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, payload });
      return;
    }

    createTaskMutation.mutate(payload as CreateTaskRequest);
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
        assignableUsers={assignableUsers}
        epicOptions={epicOptions}
        error={mutationError}
        form={taskForm}
        mode={editingTask ? 'edit' : 'create'}
        onChange={setTaskForm}
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
              ]}
            />
            <Button leftSection={<Plus size={16} />} onClick={openCreateTask}>
              New task
            </Button>
          </Group>
        </Group>

        <Paper withBorder radius="md" p="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
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
