import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { notifications } from '@mantine/notifications';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Divider,
  FileInput,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import type {
  AcceptanceCriteriaInput,
  AuditLogEntry,
  ChatMessage,
  CreateInvitationRequest,
  CreateSprintRequest,
  CreateTaskRequest,
  CurrentUser,
  InvitationResponse,
  PendingChatAction,
  LoginRequest,
  RegisterRequest,
  ReorderTasksRequest,
  Sprint,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskDetail,
  TaskQuery,
  UpdateTaskRequest,
  UserSummary,
} from '@nx-temp/data';
import {
  IssueType,
  Role,
  SprintState,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Check,
  Copy,
  Eye,
  FileText,
  Flag,
  GripVertical,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Paperclip,
  Plus,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiClient, ApiClientError } from '~/lib/api-client';
import {
  clearSession,
  getStoredSession,
  saveSession,
} from '~/lib/auth-storage';

type AuthMode = 'login' | 'signup';
type WorkspaceSection =
  | 'tasks'
  | 'team'
  | 'sprints'
  | 'chat'
  | 'reports'
  | 'audit';
type ViewMode = 'board' | 'list';

interface TaskFormState {
  title: string;
  description: string;
  issueType: IssueType;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  storyPoints: number | '';
  sprintId: string;
  parentEpicId: string;
  assigneeId: string;
  dueDate: string;
  tagsText: string;
  acceptanceCriteriaText: string;
}

interface InvitationFormState {
  email: string;
  role: Role;
}

interface SprintFormState {
  name: string;
  goal: string;
  capacityPoints: number | '';
  startDate: string;
  endDate: string;
}

const statusColumns = [
  { status: TaskStatus.Backlog, label: 'Backlog', color: 'gray' },
  { status: TaskStatus.Todo, label: 'Todo', color: 'blue' },
  { status: TaskStatus.InProgress, label: 'In progress', color: 'yellow' },
  { status: TaskStatus.InReview, label: 'Review', color: 'violet' },
  { status: TaskStatus.Done, label: 'Done', color: 'green' },
] as const;

const priorityColor: Record<TaskPriority, string> = {
  [TaskPriority.Low]: 'gray',
  [TaskPriority.Medium]: 'blue',
  [TaskPriority.High]: 'red',
};

const emptyTaskForm: TaskFormState = {
  title: '',
  description: '',
  issueType: IssueType.Task,
  category: TaskCategory.Work,
  priority: TaskPriority.Medium,
  status: TaskStatus.Todo,
  storyPoints: '',
  sprintId: '',
  parentEpicId: '',
  assigneeId: '',
  dueDate: '',
  tagsText: '',
  acceptanceCriteriaText: '',
};

const emptyInvitationForm: InvitationFormState = {
  email: '',
  role: Role.Viewer,
};

const emptySprintForm: SprintFormState = {
  name: '',
  goal: '',
  capacityPoints: '',
  startDate: '',
  endDate: '',
};

export const Route = createFileRoute('/')({
  component: HomeRoute,
});

function HomeRoute() {
  const [sessionUser, setSessionUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setSessionUser(getStoredSession()?.user ?? null);
  }, []);

  if (sessionUser) {
    return (
      <TaskWorkspace
        initialUser={sessionUser}
        onSignedOut={() => setSessionUser(null)}
      />
    );
  }

  return <AuthLandingPage onAuthenticated={setSessionUser} />;
}

function AuthLandingPage({
  onAuthenticated,
}: {
  onAuthenticated: (user: CurrentUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginForm, setLoginForm] = useState<LoginRequest>({
    email: 'owner@acme.test',
    password: 'Password123!',
  });
  const [signupForm, setSignupForm] = useState<RegisterRequest>({
    organizationName: '',
    fullName: '',
    email: '',
    password: '',
  });

  const loginMutation = useMutation({
    mutationFn: apiClient.login,
    onSuccess: (session) => {
      saveSession(session);
      onAuthenticated(session.user);
    },
  });

  const signupMutation = useMutation({
    mutationFn: apiClient.register,
    onSuccess: (session) => {
      saveSession(session);
      onAuthenticated(session.user);
    },
  });

  const pending = loginMutation.isPending || signupMutation.isPending;
  const activeError = useMemo(() => {
    const error = loginMutation.error ?? signupMutation.error;
    if (!error) {
      return null;
    }

    return error instanceof ApiClientError
      ? error.message
      : 'Something went wrong. Try again.';
  }, [loginMutation.error, signupMutation.error]);

  return (
    <Box className="auth-page">
      <Container size="xl" py={{ base: 'md', md: 'xl' }}>
        <Paper withBorder shadow="xl" radius="md" className="auth-shell">
          <Box className="auth-shell-grid">
            <Box className="auth-panel">
              <Stack justify="space-between" h="100%" gap="xl">
                <Group gap="sm">
                  <ThemeIcon size={44} radius="md" color="gray.0" c="dark.8">
                    <ClipboardList size={22} aria-hidden="true" />
                  </ThemeIcon>
                  <Box>
                    <Text size="xs" fw={700} tt="uppercase" c="blue.1">
                      Turbo Vets
                    </Text>
                    <Text size="sm" c="gray.4">
                      SaaS work management
                    </Text>
                  </Box>
                </Group>

                <Stack gap="md" maw={560}>
                  <Title order={1} size="h1" lh={1.08} c="white">
                    Plan sprints, manage issues, and keep tenant data separated.
                  </Title>
                  <Text size="md" lh={1.7} c="gray.3">
                    Keep issue work, sprint flow, and team ownership visible
                    across every active organization.
                  </Text>
                </Stack>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {[
                    ['Multi-org ready', Users],
                    ['Password auth', ShieldCheck],
                    ['Sprints and epics', Sparkles],
                    ['Task workspace', ListChecks],
                  ].map(([label, Icon]) => (
                    <Paper
                      key={label as string}
                      radius="md"
                      p="sm"
                      className="auth-feature"
                    >
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon
                          size={30}
                          radius="md"
                          color="blue"
                          variant="light"
                        >
                          <Icon size={16} aria-hidden="true" />
                        </ThemeIcon>
                        <Text size="sm" c="gray.1">
                          {label as string}
                        </Text>
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            </Box>

            <Center h="100%" p={{ base: 'md', sm: 'xl' }}>
              <Stack w="100%" maw={430} gap="lg">
                <SegmentedControl
                  fullWidth
                  value={mode}
                  onChange={(value) => setMode(value as AuthMode)}
                  data={[
                    { label: 'Sign in', value: 'login' },
                    { label: 'Create org', value: 'signup' },
                  ]}
                />

                <Paper withBorder radius="md" p="xl" shadow="sm">
                  <Stack gap="lg">
                    <Box>
                      <Title order={2} size="h2">
                        {mode === 'login'
                          ? 'Welcome back'
                          : 'Start a workspace'}
                      </Title>
                      <Text mt={4} size="sm" c="dimmed">
                        {mode === 'login'
                          ? 'Use your existing workspace credentials.'
                          : 'Create the first owner for a new organization.'}
                      </Text>
                    </Box>

                    {mode === 'login' ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          loginMutation.mutate(loginForm);
                        }}
                      >
                        <Stack gap="md">
                          <TextInput
                            label="Email"
                            type="email"
                            autoComplete="email"
                            leftSection={<Mail size={16} />}
                            value={loginForm.email}
                            onChange={(event) =>
                              setLoginForm((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            required
                          />
                          <PasswordInput
                            label="Password"
                            autoComplete="current-password"
                            value={loginForm.password}
                            onChange={(event) =>
                              setLoginForm((current) => ({
                                ...current,
                                password: event.target.value,
                              }))
                            }
                            required
                          />
                          <Text size="sm" ta="right">
                            <Text component={Link} to="/forgot-password" c="blue" inherit>
                              Forgot password?
                            </Text>
                          </Text>
                          <SubmitButton pending={pending}>Sign in</SubmitButton>
                        </Stack>
                      </form>
                    ) : (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          signupMutation.mutate(signupForm);
                        }}
                      >
                        <Stack gap="md">
                          <TextInput
                            label="Organization"
                            leftSection={<Building2 size={16} />}
                            value={signupForm.organizationName}
                            onChange={(event) =>
                              setSignupForm((current) => ({
                                ...current,
                                organizationName: event.target.value,
                              }))
                            }
                            required
                            minLength={2}
                          />
                          <TextInput
                            label="Full name"
                            value={signupForm.fullName}
                            onChange={(event) =>
                              setSignupForm((current) => ({
                                ...current,
                                fullName: event.target.value,
                              }))
                            }
                            required
                          />
                          <TextInput
                            label="Work email"
                            type="email"
                            autoComplete="email"
                            leftSection={<Mail size={16} />}
                            value={signupForm.email}
                            onChange={(event) =>
                              setSignupForm((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            required
                          />
                          <PasswordInput
                            label="Password"
                            autoComplete="new-password"
                            minLength={8}
                            value={signupForm.password}
                            onChange={(event) =>
                              setSignupForm((current) => ({
                                ...current,
                                password: event.target.value,
                              }))
                            }
                            required
                          />
                          <SubmitButton pending={pending}>
                            Create workspace
                          </SubmitButton>
                        </Stack>
                      </form>
                    )}

                    {activeError ? (
                      <Alert color="red" variant="light">
                        {activeError}
                      </Alert>
                    ) : null}
                  </Stack>
                </Paper>
              </Stack>
            </Center>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

function TaskWorkspace({
  initialUser,
  onSignedOut,
}: {
  initialUser: CurrentUser;
  onSignedOut: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('tasks');
  const [filters, setFilters] = useState<TaskQuery>({
    sortBy: 'position',
    order: 'asc',
  });
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm);
  const [orgSwitchError, setOrgSwitchError] = useState('');

  const userQuery = useQuery({
    queryKey: ['me'],
    queryFn: apiClient.me,
    initialData: initialUser,
  });
  const user = userQuery.data;

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
      (task) => task.issueType === IssueType.Epic && task.id !== editingTask?.id,
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
  const organizationOptions = user.memberships.map((membership) => ({
    value: membership.organizationId,
    label: membership.organizationName,
  }));

  const signOut = () => {
    clearSession();
    queryClient.clear();
    onSignedOut();
  };

  const refreshTasks = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>([
        'tasks',
        filters,
      ]);
      queryClient.setQueryData<Task[]>(['tasks', filters], (current = []) =>
        mergeReorderedTasks(current, payload),
      );

      return { previousTasks };
    },
    onSuccess: (updatedTasks) => {
      queryClient.setQueryData<Task[]>(['tasks', filters], (current = []) =>
        mergeTasks(current, updatedTasks),
      );
      notifications.show({
        color: 'green',
        message: 'Task order and status were saved.',
        title: 'Board updated',
      });
    },
    onError: (error, _payload, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', filters], context.previousTasks);
      }
      notifications.show({
        color: 'red',
        message: formatError(error),
        title: 'Reorder failed',
      });
    },
  });
  const switchOrgMutation = useMutation({
    mutationFn: apiClient.switchOrg,
    onMutate: () => setOrgSwitchError(''),
    onSuccess: async (session) => {
      saveSession(session);
      queryClient.setQueryData(['me'], session.user);
      setFilters({ sortBy: 'position', order: 'asc' });
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

  return (
    <Box className="workspace-page">
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
      <TaskDetailModal
        opened={detailTaskId != null}
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onTasksChanged={refreshTasks}
      />
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
            <Button
              justify="flex-start"
              variant={activeSection === 'tasks' ? 'light' : 'subtle'}
              color={activeSection === 'tasks' ? 'blue' : 'gray'}
              leftSection={<LayoutDashboard size={16} />}
              onClick={() => setActiveSection('tasks')}
            >
              Tasks
            </Button>
            <Button
              justify="flex-start"
              variant={activeSection === 'team' ? 'light' : 'subtle'}
              color={activeSection === 'team' ? 'blue' : 'gray'}
              leftSection={<Users size={16} />}
              onClick={() => setActiveSection('team')}
            >
              Team
            </Button>
            <Button
              justify="flex-start"
              variant={activeSection === 'sprints' ? 'light' : 'subtle'}
              color={activeSection === 'sprints' ? 'blue' : 'gray'}
              leftSection={<Flag size={16} />}
              onClick={() => setActiveSection('sprints')}
            >
              Sprints
            </Button>
            <Button
              justify="flex-start"
              variant={activeSection === 'chat' ? 'light' : 'subtle'}
              color={activeSection === 'chat' ? 'blue' : 'gray'}
              leftSection={<Sparkles size={16} />}
              onClick={() => setActiveSection('chat')}
            >
              AI chat
            </Button>
            <Button
              justify="flex-start"
              variant={activeSection === 'reports' ? 'light' : 'subtle'}
              color={activeSection === 'reports' ? 'blue' : 'gray'}
              leftSection={<FileText size={16} />}
              onClick={() => setActiveSection('reports')}
            >
              Reports
            </Button>
            <Button
              justify="flex-start"
              variant={activeSection === 'audit' ? 'light' : 'subtle'}
              color={activeSection === 'audit' ? 'blue' : 'gray'}
              leftSection={<ScrollText size={16} />}
              onClick={() => setActiveSection('audit')}
            >
              Audit
            </Button>
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
          {activeSection === 'team' ? (
            <TeamPanel currentUser={user} />
          ) : activeSection === 'sprints' ? (
            <SprintsPanel currentUser={user} />
          ) : activeSection === 'chat' ? (
            <ChatPanel currentUser={user} />
          ) : activeSection === 'reports' ? (
            <ReportsPanel currentUser={user} />
          ) : activeSection === 'audit' ? (
            <AuditPanel currentUser={user} />
          ) : (
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
                  <Button
                    leftSection={<Plus size={16} />}
                    onClick={openCreateTask}
                  >
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
                        sortBy:
                          (value as TaskQuery['sortBy'] | null) ?? 'position',
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
                    onOpenDetails={(task) => setDetailTaskId(task.id)}
                    onReorder={(payload) =>
                      reorderTasksMutation.mutate(payload)
                    }
                  />
                </Stack>
              ) : (
                <TaskList
                  tasks={tasks}
                  onDelete={deleteTask}
                  onEdit={openEditTask}
                  onOpenDetails={(task) => setDetailTaskId(task.id)}
                />
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function TeamPanel({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: ['team-users'] }),
      queryClient.invalidateQueries({ queryKey: ['invitations'] }),
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

function SprintsPanel({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SprintFormState>(emptySprintForm);
  const canManageSprints =
    currentUser.role === Role.Owner || currentUser.role === Role.Admin;

  const sprintsQuery = useQuery({
    queryKey: ['sprints', currentUser.organizationId],
    queryFn: () => apiClient.listSprints(),
    enabled: canManageSprints,
  });

  const refreshSprints = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sprints'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
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

  if (!canManageSprints) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Title order={1}>Sprints</Title>
        <Text c="dimmed" mt="sm">
          Sprint planning is available to organization owners and admins.
        </Text>
      </Paper>
    );
  }

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

function ChatPanel({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const [streamError, setStreamError] = useState('');

  const historyQuery = useQuery({
    queryKey: ['chat-history', currentUser.id, currentUser.organizationId],
    queryFn: () => apiClient.chatHistory({ limit: 30 }),
  });

  const refreshChatAndTasks = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['chat-history'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    ]);
  };

  const askMutation = useMutation({
    mutationFn: async (text: string) => {
      setStreamedAnswer('');
      setStreamError('');
      await apiClient.askChat({ message: text }, (event) => {
        if (event.type === 'chunk') {
          setStreamedAnswer((current) => `${current}${event.content}`);
        }
        if (event.type === 'error') {
          setStreamError(event.message);
        }
      });
    },
    onSuccess: async () => {
      setMessage('');
      setStreamedAnswer('');
      await refreshChatAndTasks();
    },
    onError: (error) => setStreamError(formatError(error)),
  });

  const confirmMutation = useMutation({
    mutationFn: apiClient.confirmPendingChatAction,
    onSuccess: refreshChatAndTasks,
  });
  const cancelMutation = useMutation({
    mutationFn: apiClient.cancelPendingChatAction,
    onSuccess: refreshChatAndTasks,
  });

  const messages = historyQuery.data?.items ?? [];
  const actionPending = confirmMutation.isPending || cancelMutation.isPending;
  const error =
    streamError ||
    formatError(
      historyQuery.error ?? confirmMutation.error ?? cancelMutation.error,
    );

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Box>
          <Title order={1}>AI Chat</Title>
          <Text c="dimmed" mt={4}>
            Ask about tasks or prepare task changes for confirmation.
          </Text>
        </Box>
      </Group>

      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          {historyQuery.isPending ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : messages.length ? (
            messages.map((chatMessage) => (
              <ChatMessageItem
                key={chatMessage.id}
                actionPending={actionPending}
                message={chatMessage}
                onCancel={(action) => cancelMutation.mutate(action.id)}
                onConfirm={(action) => confirmMutation.mutate(action.id)}
              />
            ))
          ) : (
            <Text c="dimmed">No chat history</Text>
          )}
          {streamedAnswer ? (
            <Paper withBorder radius="md" p="sm" className="task-card">
              <Text size="xs" c="dimmed" mb={4}>
                Assistant
              </Text>
              <Text size="sm">{streamedAnswer}</Text>
            </Paper>
          ) : null}
        </Stack>
      </Paper>

      {error ? <Alert color="red">{error}</Alert> : null}

      <Paper withBorder radius="md" p="md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (message.trim()) {
              askMutation.mutate(message.trim());
            }
          }}
        >
          <Stack gap="md">
            <Textarea
              autosize
              label="Message"
              maxLength={4000}
              minRows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
            <Group justify="flex-end">
              <Button
                leftSection={<Sparkles size={16} />}
                loading={askMutation.isPending}
                type="submit"
              >
                Send
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}

function ChatMessageItem({
  actionPending,
  message,
  onCancel,
  onConfirm,
}: {
  actionPending: boolean;
  message: ChatMessage;
  onCancel: (action: PendingChatAction) => void;
  onConfirm: (action: PendingChatAction) => void;
}) {
  return (
    <Paper withBorder radius="md" p="sm" className="task-card">
      <Stack gap={8}>
        <Group justify="space-between">
          <Badge
            color={message.role === 'assistant' ? 'blue' : 'gray'}
            variant="light"
          >
            {message.role}
          </Badge>
          <Text size="xs" c="dimmed">
            {new Date(message.createdAt).toLocaleString()}
          </Text>
        </Group>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {message.content}
        </Text>
        {message.sources.length ? (
          <Group gap="xs">
            {message.sources.map((source) => (
              <Badge key={source.taskId} variant="outline">
                {source.title}
              </Badge>
            ))}
          </Group>
        ) : null}
        {message.pendingAction?.status === 'pending' ? (
          <Paper withBorder radius="md" p="sm">
            <Group justify="space-between" gap="sm">
              <Text size="sm" fw={700}>
                {message.pendingAction.summary}
              </Text>
              <Group gap="xs">
                <Button
                  color="green"
                  leftSection={<Check size={14} />}
                  size="compact-xs"
                  disabled={actionPending}
                  onClick={() =>
                    onConfirm(message.pendingAction as PendingChatAction)
                  }
                >
                  Confirm
                </Button>
                <Button
                  color="red"
                  leftSection={<X size={14} />}
                  size="compact-xs"
                  variant="subtle"
                  disabled={actionPending}
                  onClick={() =>
                    onCancel(message.pendingAction as PendingChatAction)
                  }
                >
                  Cancel
                </Button>
              </Group>
            </Group>
          </Paper>
        ) : null}
      </Stack>
    </Paper>
  );
}

function ReportsPanel({ currentUser }: { currentUser: CurrentUser }) {
  const reportQuery = useQuery({
    queryKey: ['standup-report', currentUser.organizationId],
    queryFn: apiClient.standupReport,
    enabled: false,
  });

  const report = reportQuery.data?.report ?? '';
  const reportBlocks = useMemo(() => renderReportMarkdown(report), [report]);

  const copyReport = async () => {
    if (!report) {
      return;
    }

    try {
      await navigator.clipboard.writeText(report);
      notifications.show({
        color: 'green',
        message: 'Standup report copied to clipboard.',
        title: 'Copied',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: formatError(error),
        title: 'Copy failed',
      });
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Box>
          <Title order={1}>Reports</Title>
          <Text c="dimmed" mt={4}>
            {currentUser.organizationName}
          </Text>
        </Box>
        <Button
          leftSection={
            report ? <RefreshCw size={16} /> : <Sparkles size={16} />
          }
          loading={reportQuery.isFetching}
          variant={report ? 'default' : 'filled'}
          onClick={() => reportQuery.refetch()}
        >
          {report ? 'Regenerate' : 'Generate'}
        </Button>
      </Group>

      {reportQuery.isError ? (
        <Alert color="red">{formatError(reportQuery.error)}</Alert>
      ) : null}

      <Paper withBorder radius="md" p="lg">
        {reportQuery.isFetching ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : report ? (
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="md">
              <Box>
                <Text fw={800}>Report generated</Text>
                <Text c="dimmed" size="sm">
                  {new Date().toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'long',
                    weekday: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </Box>
              <Button
                leftSection={<Copy size={16} />}
                size="xs"
                variant="default"
                onClick={copyReport}
              >
                Copy
              </Button>
            </Group>
            <Box className="report-output">{reportBlocks}</Box>
          </Stack>
        ) : (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size={56} radius="md" variant="light">
                <FileText size={28} />
              </ThemeIcon>
              <Text fw={800}>No report generated</Text>
              <Text c="dimmed" maw={420} ta="center">
                Generate a standup report when you need the latest team
                summary.
              </Text>
            </Stack>
          </Center>
        )}
      </Paper>
    </Stack>
  );
}

function renderReportMarkdown(markdown: string) {
  const blocks: ReactNode[] = [];
  const listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    blocks.push(
      <Box component="ul" className="report-list" key={`list-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </Box>,
    );
    listItems.length = 0;
  };

  for (const line of markdown.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      flushList();
      continue;
    }

    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      listItems.push(trimmedLine.slice(2));
      continue;
    }

    flushList();
    if (trimmedLine.startsWith('### ')) {
      blocks.push(
        <Title order={4} key={`h3-${blocks.length}`}>
          {renderInlineMarkdown(trimmedLine.slice(4))}
        </Title>,
      );
    } else if (trimmedLine.startsWith('## ')) {
      blocks.push(
        <Title order={3} key={`h2-${blocks.length}`}>
          {renderInlineMarkdown(trimmedLine.slice(3))}
        </Title>,
      );
    } else if (trimmedLine.startsWith('# ')) {
      blocks.push(
        <Title order={2} key={`h1-${blocks.length}`}>
          {renderInlineMarkdown(trimmedLine.slice(2))}
        </Title>,
      );
    } else if (trimmedLine === '---') {
      blocks.push(<Divider key={`hr-${blocks.length}`} />);
    } else {
      blocks.push(
        <Text key={`p-${blocks.length}`}>
          {renderInlineMarkdown(trimmedLine)}
        </Text>,
      );
    }
  }

  flushList();
  return blocks;
}

function renderInlineMarkdown(text: string) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${token}-${match.index}`}>{token.slice(2, -2)}</strong>,
      );
    } else {
      parts.push(
        <em key={`${token}-${match.index}`}>{token.slice(1, -1)}</em>,
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function AuditPanel({ currentUser }: { currentUser: CurrentUser }) {
  const [limit, setLimit] = useState(50);
  const canReadAudit =
    currentUser.role === Role.Owner || currentUser.role === Role.Admin;
  const auditQuery = useQuery({
    queryKey: ['audit-log', currentUser.organizationId, limit],
    queryFn: () => apiClient.auditLog({ limit }),
    enabled: canReadAudit,
  });

  if (!canReadAudit) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Title order={1}>Audit</Title>
        <Text c="dimmed" mt="sm">
          Audit log access is available to organization owners and admins.
        </Text>
      </Paper>
    );
  }

  const entries = auditQuery.data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Box>
          <Title order={1}>Audit</Title>
          <Text c="dimmed" mt={4}>
            {entries.length} recent entries
          </Text>
        </Box>
        <Group gap="sm">
          <Select
            allowDeselect={false}
            data={[
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
            value={String(limit)}
            w={96}
            onChange={(value) => setLimit(Number(value ?? 50))}
          />
          <Button
            leftSection={<RefreshCw size={16} />}
            loading={auditQuery.isFetching}
            variant="default"
            onClick={() => auditQuery.refetch()}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {auditQuery.isError ? (
        <Alert color="red">{formatError(auditQuery.error)}</Alert>
      ) : null}

      <Paper withBorder radius="md" p={0}>
        <Table.ScrollContainer minWidth={920}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Actor</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Resource</Table.Th>
                <Table.Th>Result</Table.Th>
                <Table.Th>Metadata</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {auditQuery.isPending ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Center py="lg">
                      <Loader size="sm" />
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : entries.length ? (
                entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" py="md">
                      No audit entries
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

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm">{new Date(entry.createdAt).toLocaleString()}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{entry.actorEmail ?? 'System'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={700}>
          {entry.action}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">
          {entry.resource}
          {entry.resourceId ? ` ${entry.resourceId}` : ''}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge color={entry.allowed ? 'green' : 'red'} variant="light">
          {entry.allowed ? 'Allowed' : 'Denied'}
        </Badge>
        {entry.reason ? (
          <Text size="xs" c="dimmed" mt={4}>
            {entry.reason}
          </Text>
        ) : null}
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed" lineClamp={3}>
          {formatMetadata(entry.metadata)}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

function TaskDetailModal({
  opened,
  taskId,
  onClose,
  onTasksChanged,
}: {
  opened: boolean;
  taskId: string | null;
  onClose: () => void;
  onTasksChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  useEffect(() => {
    if (!opened) {
      setComment('');
      setAttachment(null);
    }
  }, [opened, taskId]);

  const detailQuery = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: () => apiClient.getTaskDetail(taskId ?? ''),
    enabled: opened && taskId != null,
  });

  const refreshDetail = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] }),
      onTasksChanged(),
    ]);
  };

  const commentMutation = useMutation({
    mutationFn: (message: string) =>
      apiClient.addTaskComment(taskId ?? '', { message }),
    onSuccess: async () => {
      setComment('');
      await refreshDetail();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      apiClient.uploadTaskAttachment(taskId ?? '', file),
    onSuccess: async () => {
      setAttachment(null);
      await refreshDetail();
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      apiClient.deleteTaskAttachment(taskId ?? '', attachmentId),
    onSuccess: refreshDetail,
  });

  const task = detailQuery.data;
  const actionError = formatError(
    commentMutation.error ??
      uploadMutation.error ??
      deleteAttachmentMutation.error,
  );

  const submitComment = () => {
    const message = comment.trim();
    if (message) {
      commentMutation.mutate(message);
    }
  };

  const uploadAttachment = () => {
    if (attachment) {
      uploadMutation.mutate(attachment);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={task?.title ?? 'Task details'}
      size="xl"
      centered
    >
      {detailQuery.isPending ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : detailQuery.isError ? (
        <Alert color="red">{formatError(detailQuery.error)}</Alert>
      ) : task ? (
        <Stack gap="lg">
          <TaskDetailSummary task={task} />

          <Divider />

          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={800}>Comments</Text>
              <Badge variant="light">{task.activities.length} activities</Badge>
            </Group>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitComment();
              }}
            >
              <Stack gap="sm">
                <Textarea
                  autosize
                  minRows={2}
                  maxLength={2000}
                  placeholder="Add a comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
                <Group justify="flex-end">
                  <Button
                    disabled={!comment.trim()}
                    leftSection={<MessageSquare size={16} />}
                    loading={commentMutation.isPending}
                    type="submit"
                  >
                    Comment
                  </Button>
                </Group>
              </Stack>
            </form>
            <TaskActivityList activities={task.activities} />
          </Stack>

          <Divider />

          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={800}>Attachments</Text>
              <Badge variant="light">{task.attachments.length} images</Badge>
            </Group>
            <Group align="flex-end" gap="sm">
              <FileInput
                accept="image/*"
                clearable
                leftSection={<Paperclip size={16} />}
                label="Image"
                placeholder="Select image"
                value={attachment}
                onChange={setAttachment}
                flex={1}
              />
              <Button
                disabled={!attachment}
                leftSection={<Paperclip size={16} />}
                loading={uploadMutation.isPending}
                onClick={uploadAttachment}
              >
                Upload
              </Button>
            </Group>
            <TaskAttachmentGrid
              attachments={task.attachments}
              deletingId={
                deleteAttachmentMutation.variables as string | undefined
              }
              pending={deleteAttachmentMutation.isPending}
              taskId={task.id}
              onDelete={(attachmentId) =>
                deleteAttachmentMutation.mutate(attachmentId)
              }
            />
          </Stack>

          {actionError ? <Alert color="red">{actionError}</Alert> : null}
        </Stack>
      ) : null}
    </Modal>
  );
}

function TaskDetailSummary({ task }: { task: TaskDetail }) {
  const completedCriteria = task.acceptanceCriteria.filter(
    (item) => item.completed,
  ).length;

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Badge variant="light">{task.issueType}</Badge>
        <Badge color={priorityColor[task.priority]} variant="light">
          {task.priority}
        </Badge>
        <Badge variant="outline">{task.status}</Badge>
        {task.storyPoints != null ? (
          <Badge variant="outline">{task.storyPoints} pt</Badge>
        ) : null}
      </Group>
      <Text c={task.description ? undefined : 'dimmed'}>
        {task.description ?? 'No description'}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Text size="sm">
          <Text span fw={700}>
            Assignee:
          </Text>{' '}
          {task.assigneeName ?? 'Unassigned'}
        </Text>
        <Text size="sm">
          <Text span fw={700}>
            Sprint:
          </Text>{' '}
          {task.sprintName ?? 'Backlog'}
        </Text>
        <Text size="sm">
          <Text span fw={700}>
            Epic:
          </Text>{' '}
          {task.parentEpicTitle ?? 'None'}
        </Text>
        <Text size="sm">
          <Text span fw={700}>
            Acceptance:
          </Text>{' '}
          {completedCriteria}/{task.acceptanceCriteria.length}
        </Text>
      </SimpleGrid>
    </Stack>
  );
}

function TaskActivityList({ activities }: { activities: TaskActivity[] }) {
  if (activities.length === 0) {
    return <Text c="dimmed">No activity yet.</Text>;
  }

  return (
    <Stack gap="xs">
      {activities.map((activity) => (
        <Paper key={activity.id} withBorder radius="md" p="sm">
          <Group justify="space-between" gap="sm">
            <Group gap="xs">
              <MessageSquare size={15} />
              <Text size="sm" fw={700}>
                {activity.actorName ?? 'System'}
              </Text>
              <Badge size="xs" variant="light">
                {activity.type}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {new Date(activity.createdAt).toLocaleString()}
            </Text>
          </Group>
          <Text size="sm" mt={6}>
            {activity.message}
          </Text>
        </Paper>
      ))}
    </Stack>
  );
}

function TaskAttachmentGrid({
  attachments,
  deletingId,
  pending,
  taskId,
  onDelete,
}: {
  attachments: TaskAttachment[];
  deletingId?: string;
  pending: boolean;
  taskId: string;
  onDelete: (attachmentId: string) => void;
}) {
  if (attachments.length === 0) {
    return <Text c="dimmed">No attachments.</Text>;
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      {attachments.map((attachment) => (
        <Paper key={attachment.id} withBorder radius="md" p="sm">
          <Stack gap="sm">
            <AttachmentPreview attachment={attachment} taskId={taskId} />
            <Group justify="space-between" gap="sm">
              <Box>
                <Text size="sm" fw={700} lineClamp={1}>
                  {attachment.fileName}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatBytes(attachment.byteSize)}
                </Text>
              </Box>
              <Button
                color="red"
                leftSection={<Trash2 size={14} />}
                loading={pending && deletingId === attachment.id}
                size="compact-xs"
                variant="subtle"
                onClick={() => onDelete(attachment.id)}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

function AttachmentPreview({
  attachment,
  taskId,
}: {
  attachment: TaskAttachment;
  taskId: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const imageQuery = useQuery({
    queryKey: ['task-attachment', taskId, attachment.id],
    queryFn: () => apiClient.downloadTaskAttachment(taskId, attachment.id),
  });

  useEffect(() => {
    if (!imageQuery.data) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageQuery.data);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageQuery.data]);

  if (imageQuery.isPending) {
    return (
      <Center className="attachment-preview">
        <Loader size="sm" />
      </Center>
    );
  }

  if (imageQuery.isError || !objectUrl) {
    return (
      <Center className="attachment-preview">
        <ImageIcon size={24} />
      </Center>
    );
  }

  return (
    <Box
      alt={attachment.fileName}
      className="attachment-preview"
      component="img"
      src={objectUrl}
    />
  );
}

function TaskBoard({
  canReorder,
  groupedTasks,
  reorderPending,
  onDelete,
  onEdit,
  onOpenDetails,
  onReorder,
}: {
  canReorder: boolean;
  groupedTasks: Record<TaskStatus, Task[]>;
  reorderPending: boolean;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onOpenDetails: (task: Task) => void;
  onReorder: (payload: ReorderTasksRequest) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeStartStatus, setActiveStartStatus] = useState<TaskStatus | null>(
    null,
  );
  const [localBoard, setLocalBoard] =
    useState<Record<TaskStatus, Task[]> | null>(null);
  const lastDragOverKeyRef = useRef('');
  const visibleBoard = localBoard ?? groupedTasks;
  const taskLookup = useMemo(() => {
    const lookup = new Map<string, Task>();
    for (const tasks of Object.values(visibleBoard)) {
      for (const task of tasks) {
        lookup.set(task.id, task);
      }
    }
    return lookup;
  }, [visibleBoard]);
  const activeTask = activeTaskId ? taskLookup.get(activeTaskId) : null;

  const finishDrag = () => {
    lastDragOverKeyRef.current = '';
    setActiveTaskId(null);
    setActiveStartStatus(null);
    setLocalBoard(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!canReorder || reorderPending) {
      return;
    }

    const task = findTaskInBoard(groupedTasks, String(event.active.id));
    if (!task) {
      return;
    }

    setActiveTaskId(task.id);
    setActiveStartStatus(task.status);
    lastDragOverKeyRef.current = '';
    setLocalBoard(cloneTaskBoard(groupedTasks));
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!canReorder || reorderPending || !event.over) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const dragOverKey = `${activeId}:${overId}`;
    if (lastDragOverKeyRef.current === dragOverKey) {
      return;
    }
    lastDragOverKeyRef.current = dragOverKey;

    setLocalBoard((currentBoard) => {
      if (!currentBoard) {
        return currentBoard;
      }

      const overTask = findTaskInBoard(currentBoard, overId);
      const targetStatus = overTask?.status ?? parseTaskStatus(overId);
      if (!targetStatus) {
        return currentBoard;
      }

      return moveTaskInBoard(currentBoard, activeId, targetStatus, overTask?.id);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canReorder || reorderPending || !event.over) {
      finishDrag();
      return;
    }

    const board = localBoard ?? groupedTasks;
    const originalTask = findTaskInBoard(groupedTasks, String(event.active.id));
    const movedTask = findTaskInBoard(board, String(event.active.id));
    if (!originalTask || !movedTask || !activeStartStatus) {
      finishDrag();
      return;
    }

    if (
      originalTask.status === movedTask.status &&
      originalTask.position === movedTask.position
    ) {
      finishDrag();
      return;
    }

    const result = taskBoardToReorderPayload(
      board,
      uniqueTaskStatuses([activeStartStatus, movedTask.status]),
      groupedTasks,
    );
    if (result.length === 0) {
      finishDrag();
      return;
    }

    onReorder({ tasks: result });
    finishDrag();
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragCancel={finishDrag}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
    >
      <SimpleGrid cols={{ base: 1, md: 2, xl: 5 }} spacing="md">
        {statusColumns.map((column) => (
          <TaskColumn
            key={column.status}
            canReorder={canReorder}
            column={column}
            reorderPending={reorderPending}
            tasks={visibleBoard[column.status]}
            onDelete={onDelete}
            onEdit={onEdit}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </SimpleGrid>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskDragPreview task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function TaskColumn({
  canReorder,
  column,
  reorderPending,
  tasks,
  onDelete,
  onEdit,
  onOpenDetails,
}: {
  canReorder: boolean;
  column: (typeof statusColumns)[number];
  reorderPending: boolean;
  tasks: Task[];
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onOpenDetails: (task: Task) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: column.status,
    disabled: !canReorder || reorderPending,
  });

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p="md"
      className="task-column"
    >
      <Group justify="space-between" mb="sm">
        <Text fw={800} size="sm">
          {column.label}
        </Text>
        <Badge color={column.color} variant="light">
          {tasks.length}
        </Badge>
      </Group>

      <SortableContext
        disabled={!canReorder || reorderPending}
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <Stack gap="sm">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              canReorder={canReorder}
              reorderPending={reorderPending}
              task={task}
              onDelete={onDelete}
              onEdit={onEdit}
              onOpenDetails={onOpenDetails}
            />
          ))}
          {tasks.length === 0 ? (
            <Text size="sm" c="dimmed" py="md">
              No tasks
            </Text>
          ) : null}
        </Stack>
      </SortableContext>
    </Paper>
  );
}

function TaskCard({
  canReorder = false,
  reorderPending = false,
  task,
  onDelete,
  onEdit,
  onOpenDetails,
}: {
  canReorder?: boolean;
  reorderPending?: boolean;
  task: Task;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onOpenDetails: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !canReorder || reorderPending,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p="sm"
      className={`task-card${isDragging ? ' task-card-dragging' : ''}`}
      style={style}
    >
      <TaskCardContent
        canReorder={canReorder}
        dragHandle={
          canReorder ? (
            <Button
              aria-label={`Drag ${task.title}`}
              disabled={reorderPending}
              size="compact-xs"
              variant="subtle"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={14} />
            </Button>
          ) : null
        }
        reorderPending={reorderPending}
        task={task}
        onDelete={onDelete}
        onEdit={onEdit}
        onOpenDetails={onOpenDetails}
      />
    </Paper>
  );
}

function TaskDragPreview({ task }: { task: Task }) {
  return (
    <Paper withBorder radius="md" p="sm" className="task-card task-card-overlay">
      <TaskCardContent task={task} />
    </Paper>
  );
}

function TaskCardContent({
  canReorder = false,
  dragHandle,
  reorderPending = false,
  task,
  onDelete,
  onEdit,
  onOpenDetails,
}: {
  canReorder?: boolean;
  dragHandle?: ReactNode;
  reorderPending?: boolean;
  task: Task;
  onDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onOpenDetails?: (task: Task) => void;
}) {
  return (
    <Stack gap={8}>
      <Group justify="space-between" gap="xs">
        <Group gap={4}>
          {canReorder && !reorderPending ? dragHandle : null}
          <Badge color={priorityColor[task.priority]} variant="light">
            {task.priority}
          </Badge>
        </Group>
        {onOpenDetails && onEdit && onDelete ? (
          <Group gap={4}>
            <Button
              aria-label={`View ${task.title}`}
              size="compact-xs"
              variant="subtle"
              onClick={() => onOpenDetails(task)}
            >
              <Eye size={14} />
            </Button>
            <Button
              aria-label={`Edit ${task.title}`}
              size="compact-xs"
              variant="subtle"
              onClick={() => onEdit(task)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              aria-label={`Delete ${task.title}`}
              color="red"
              size="compact-xs"
              variant="subtle"
              onClick={() => onDelete(task)}
            >
              <Trash2 size={14} />
            </Button>
          </Group>
        ) : null}
      </Group>
      <Text fw={700} size="sm" lineClamp={2}>
        {task.title}
      </Text>
      <Text size="xs" c="dimmed" lineClamp={2}>
        {task.description ?? 'No description'}
      </Text>
      <Group justify="space-between" gap="xs">
        <Text size="xs" c="dimmed">
          {task.assigneeName ?? 'Unassigned'}
        </Text>
        <Group gap={4}>
          <Badge variant="outline">{task.issueType}</Badge>
          {task.storyPoints != null ? (
            <Badge variant="outline">{task.storyPoints} pt</Badge>
          ) : null}
        </Group>
      </Group>
    </Stack>
  );
}

function TaskList({
  tasks,
  onDelete,
  onEdit,
  onOpenDetails,
}: {
  tasks: Task[];
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onOpenDetails: (task: Task) => void;
}) {
  if (tasks.length === 0) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Text c="dimmed">No tasks match the current filters.</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="md" p={0}>
      <Table.ScrollContainer minWidth={760}>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Assignee</Table.Th>
              <Table.Th>Sprint</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tasks.map((task) => (
              <Table.Tr key={task.id}>
                <Table.Td>
                  <Text fw={700} size="sm">
                    {task.title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {task.issueType} in {task.organizationName}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{task.status}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={priorityColor[task.priority]} variant="light">
                    {task.priority}
                  </Badge>
                </Table.Td>
                <Table.Td>{task.assigneeName ?? 'Unassigned'}</Table.Td>
                <Table.Td>{task.sprintName ?? 'Backlog'}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => onOpenDetails(task)}
                    >
                      <Eye size={14} />
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => onEdit(task)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      color="red"
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => onDelete(task)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

function TaskFormModal({
  assignableUsers,
  epicOptions,
  error,
  form,
  mode,
  onChange,
  onClose,
  onDelete,
  onSave,
  opened,
  pending,
  sprintOptions,
}: {
  assignableUsers: UserSummary[];
  epicOptions: Task[];
  error: string;
  form: TaskFormState;
  mode: 'create' | 'edit';
  onChange: (form: TaskFormState) => void;
  onClose: () => void;
  onDelete?: () => void;
  onSave: () => void;
  opened: boolean;
  pending: boolean;
  sprintOptions: Sprint[];
}) {
  const update = <TKey extends keyof TaskFormState>(
    key: TKey,
    value: TaskFormState[TKey],
  ) => {
    onChange({ ...form, [key]: value });
  };
  const updateIssueType = (issueType: IssueType) => {
    onChange({
      ...form,
      issueType,
      parentEpicId: issueType === IssueType.Epic ? '' : form.parentEpicId,
      sprintId: issueType === IssueType.Epic ? '' : form.sprintId,
    });
  };
  const epicDisabled = form.issueType === IssueType.Epic;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'create' ? 'New task' : 'Edit task'}
      centered
      size="xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Title"
            maxLength={160}
            required
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
          />
          <Textarea
            autosize
            label="Description"
            maxLength={2000}
            minRows={3}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              allowDeselect={false}
              label="Type"
              data={[
                { value: IssueType.Task, label: 'Task' },
                { value: IssueType.Bug, label: 'Bug' },
                { value: IssueType.Story, label: 'Story' },
                { value: IssueType.Epic, label: 'Epic' },
              ]}
              value={form.issueType}
              onChange={(value) => updateIssueType(value as IssueType)}
            />
            <Select
              allowDeselect={false}
              label="Status"
              data={statusColumns.map((column) => ({
                value: column.status,
                label: column.label,
              }))}
              value={form.status}
              onChange={(value) => update('status', value as TaskStatus)}
            />
            <Select
              allowDeselect={false}
              label="Category"
              data={[
                { value: TaskCategory.Work, label: 'Work' },
                { value: TaskCategory.Personal, label: 'Personal' },
                { value: TaskCategory.Ops, label: 'Ops' },
              ]}
              value={form.category}
              onChange={(value) => update('category', value as TaskCategory)}
            />
            <Select
              allowDeselect={false}
              label="Priority"
              data={[
                { value: TaskPriority.Low, label: 'Low' },
                { value: TaskPriority.Medium, label: 'Medium' },
                { value: TaskPriority.High, label: 'High' },
              ]}
              value={form.priority}
              onChange={(value) => update('priority', value as TaskPriority)}
            />
          </SimpleGrid>
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            label="Story points"
            max={40}
            min={0}
            value={form.storyPoints}
            onChange={(value) =>
              update('storyPoints', typeof value === 'number' ? value : '')
            }
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              clearable
              data={epicOptions.map((task) => ({
                value: task.id,
                label: task.title,
              }))}
              disabled={epicDisabled}
              label="Epic"
              placeholder={
                epicDisabled ? 'Epics cannot belong to epics' : 'No epic'
              }
              value={form.parentEpicId || null}
              onChange={(value) => update('parentEpicId', value ?? '')}
            />
            <Select
              clearable
              data={sprintOptions.map((sprint) => ({
                value: sprint.id,
                label: `${sprint.name} - ${sprint.state}`,
              }))}
              disabled={epicDisabled}
              label="Sprint"
              placeholder={epicDisabled ? 'Epics stay in backlog' : 'Backlog'}
              value={form.sprintId || null}
              onChange={(value) => update('sprintId', value ?? '')}
            />
            <Select
              clearable
              data={assignableUsers.map((user) => ({
                value: user.id,
                label: `${user.fullName} - ${user.organizationName}`,
              }))}
              label="Assignee"
              placeholder="Unassigned"
              value={form.assigneeId || null}
              onChange={(value) => update('assigneeId', value ?? '')}
            />
            <TextInput
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(event) => update('dueDate', event.target.value)}
            />
          </SimpleGrid>
          <TextInput
            label="Tags"
            placeholder="security, auth, sprint-12"
            value={form.tagsText}
            onChange={(event) => update('tagsText', event.target.value)}
          />
          <Textarea
            autosize
            label="Acceptance criteria"
            maxLength={4800}
            minRows={3}
            placeholder="One criterion per line"
            value={form.acceptanceCriteriaText}
            onChange={(event) =>
              update('acceptanceCriteriaText', event.target.value)
            }
          />

          {error ? <Alert color="red">{error}</Alert> : null}

          <Group justify="space-between">
            {onDelete ? (
              <Button
                color="red"
                leftSection={<Trash2 size={16} />}
                type="button"
                variant="subtle"
                onClick={onDelete}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Group gap="sm">
              <Button type="button" variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={pending} type="submit">
                Save
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: string;
}) {
  return (
    <Button
      fullWidth
      type="submit"
      loading={pending}
      rightSection={pending ? <Loader2 size={16} /> : <ArrowRight size={16} />}
    >
      {children}
    </Button>
  );
}

function groupTasksByStatus(tasks: Task[]) {
  const grouped: Record<TaskStatus, Task[]> = {
    [TaskStatus.Backlog]: [],
    [TaskStatus.Todo]: [],
    [TaskStatus.InProgress]: [],
    [TaskStatus.InReview]: [],
    [TaskStatus.Done]: [],
  };

  for (const task of tasks) {
    grouped[task.status].push(task);
  }

  return grouped;
}

function parseTaskStatus(value: string): TaskStatus | null {
  return Object.values(TaskStatus).includes(value as TaskStatus)
    ? (value as TaskStatus)
    : null;
}

function cloneTaskBoard(groupedTasks: Record<TaskStatus, Task[]>) {
  return Object.fromEntries(
    Object.entries(groupedTasks).map(([status, tasks]) => [status, [...tasks]]),
  ) as Record<TaskStatus, Task[]>;
}

function findTaskInBoard(
  groupedTasks: Record<TaskStatus, Task[]>,
  taskId: string,
) {
  return Object.values(groupedTasks)
    .flat()
    .find((task) => task.id === taskId);
}

function moveTaskInBoard(
  groupedTasks: Record<TaskStatus, Task[]>,
  activeTaskId: string,
  targetStatus: TaskStatus,
  overTaskId?: string,
) {
  const activeTask = findTaskInBoard(groupedTasks, activeTaskId);
  if (!activeTask) {
    return groupedTasks;
  }

  if (activeTask.status === targetStatus && overTaskId) {
    const sourceTasks = groupedTasks[activeTask.status];
    const oldIndex = sourceTasks.findIndex((task) => task.id === activeTaskId);
    const newIndex = sourceTasks.findIndex((task) => task.id === overTaskId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return groupedTasks;
    }

    const nextBoard = cloneTaskBoard(groupedTasks);
    const reordered = nextBoard[activeTask.status];
    const [movedTask] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, movedTask);
    return nextBoard;
  }

  if (activeTask.status === targetStatus && !overTaskId) {
    const sourceTasks = groupedTasks[activeTask.status];
    const oldIndex = sourceTasks.findIndex((task) => task.id === activeTaskId);
    if (oldIndex === sourceTasks.length - 1) {
      return groupedTasks;
    }
  }

  const nextBoard = Object.fromEntries(
    Object.entries(groupedTasks).map(([status, tasks]) => [
      status,
      tasks.filter((task) => task.id !== activeTaskId),
    ]),
  ) as Record<TaskStatus, Task[]>;

  const targetTasks = nextBoard[targetStatus];
  const targetIndex = overTaskId
    ? Math.max(
        targetTasks.findIndex((task) => task.id === overTaskId),
        0,
      )
    : targetTasks.length;
  targetTasks.splice(targetIndex, 0, { ...activeTask, status: targetStatus });

  return nextBoard;
}

function uniqueTaskStatuses(statuses: TaskStatus[]) {
  return statuses.filter(
    (status, index, allStatuses) => allStatuses.indexOf(status) === index,
  );
}

function taskBoardToReorderPayload(
  groupedTasks: Record<TaskStatus, Task[]>,
  touchedStatuses: TaskStatus[],
  originalTasks?: Record<TaskStatus, Task[]>,
) {
  const originalLookup = originalTasks
    ? new Map(
        Object.values(originalTasks)
          .flat()
          .map((task) => [task.id, task]),
      )
    : null;

  return touchedStatuses.flatMap((status) =>
    groupedTasks[status].flatMap((task, position) => {
      const originalTask = originalLookup?.get(task.id);
      if (
        originalTask &&
        originalTask.status === status &&
        originalTask.position === position
      ) {
        return [];
      }

      return [
        {
          id: task.id,
          status,
          position,
        },
      ];
    }),
  );
}

function mergeReorderedTasks(
  currentTasks: Task[],
  payload: ReorderTasksRequest,
) {
  const updates = new Map(payload.tasks.map((task) => [task.id, task]));
  return currentTasks
    .map((task) => {
      const update = updates.get(task.id);
      return update
        ? { ...task, status: update.status, position: update.position }
        : task;
    })
    .sort(compareTasksByBoardOrder);
}

function mergeTasks(currentTasks: Task[], updatedTasks: Task[]) {
  const updates = new Map(updatedTasks.map((task) => [task.id, task]));
  return currentTasks
    .map((task) => updates.get(task.id) ?? task)
    .sort(compareTasksByBoardOrder);
}

function compareTasksByBoardOrder(left: Task, right: Task) {
  const leftStatusIndex = statusColumns.findIndex(
    (column) => column.status === left.status,
  );
  const rightStatusIndex = statusColumns.findIndex(
    (column) => column.status === right.status,
  );
  return leftStatusIndex - rightStatusIndex || left.position - right.position;
}

function formatError(error: unknown) {
  if (!error) {
    return '';
  }

  return error instanceof ApiClientError
    ? error.message
    : 'Unable to load workspace data.';
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return 'None';
  }

  return JSON.stringify(metadata);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function taskFormToPayload(
  form: TaskFormState,
  editingTask: Task | null,
): CreateTaskRequest {
  return {
    title: form.title.trim(),
    description: form.description.trim() ? form.description.trim() : null,
    issueType: form.issueType,
    category: form.category,
    priority: form.priority,
    status: form.status,
    storyPoints: form.storyPoints === '' ? null : form.storyPoints,
    sprintId:
      form.issueType === IssueType.Epic ? null : form.sprintId.trim() || null,
    parentEpicId:
      form.issueType === IssueType.Epic
        ? null
        : form.parentEpicId.trim() || null,
    assigneeId: form.assigneeId.trim() || null,
    dueDate: form.dueDate || null,
    tags: parseTags(form.tagsText),
    acceptanceCriteria: parseAcceptanceCriteria(
      form.acceptanceCriteriaText,
      editingTask,
    ),
  };
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function parseAcceptanceCriteria(
  value: string,
  editingTask: Task | null,
): AcceptanceCriteriaInput[] {
  const existingByText = new Map(
    (editingTask?.acceptanceCriteria ?? []).map((item) => [item.text, item]),
  );

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((text) => {
      const existing = existingByText.get(text);
      return {
        id: existing?.id,
        text: text.slice(0, 240),
        completed: existing?.completed ?? false,
      };
    });
}
