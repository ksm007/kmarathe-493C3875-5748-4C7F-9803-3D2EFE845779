import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Container,
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
import { createFileRoute } from '@tanstack/react-router';
import type {
  CreateInvitationRequest,
  CreateTaskRequest,
  CurrentUser,
  InvitationResponse,
  LoginRequest,
  RegisterRequest,
  Task,
  TaskQuery,
  UpdateTaskRequest,
  UserSummary,
} from '@nx-temp/data';
import {
  IssueType,
  Role,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Pencil,
  Plus,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiClient, ApiClientError } from '~/lib/api-client';
import {
  clearSession,
  getStoredSession,
  saveSession,
} from '~/lib/auth-storage';

type AuthMode = 'login' | 'signup';
type WorkspaceSection = 'tasks' | 'team';
type ViewMode = 'board' | 'list';

interface TaskFormState {
  title: string;
  description: string;
  issueType: IssueType;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  storyPoints: number | '';
}

interface InvitationFormState {
  email: string;
  role: Role;
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
};

const emptyInvitationForm: InvitationFormState = {
  email: '',
  role: Role.Viewer,
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
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm);
  const [orgSwitchError, setOrgSwitchError] = useState('');

  const userQuery = useQuery({
    queryKey: ['me'],
    queryFn: apiClient.me,
    initialData: initialUser,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => apiClient.listTasks(filters),
  });

  const user = userQuery.data;
  const tasks = tasksQuery.data ?? [];
  const groupedTasks = useMemo(() => groupTasksByStatus(tasks), [tasks]);
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
  const switchOrgMutation = useMutation({
    mutationFn: apiClient.switchOrg,
    onMutate: () => setOrgSwitchError(''),
    onSuccess: async (session) => {
      saveSession(session);
      queryClient.setQueryData(['me'], session.user);
      setFilters({ sortBy: 'position', order: 'asc' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['team-users'] }),
        queryClient.invalidateQueries({ queryKey: ['invitations'] }),
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
    });
    setTaskFormOpen(true);
  };

  const closeTaskForm = () => {
    setTaskFormOpen(false);
    setEditingTask(null);
    setTaskForm(emptyTaskForm);
  };

  const saveTask = () => {
    const payload = taskFormToPayload(taskForm);
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
        error={mutationError}
        form={taskForm}
        mode={editingTask ? 'edit' : 'create'}
        onChange={setTaskForm}
        onClose={closeTaskForm}
        onDelete={editingTask ? () => deleteTask(editingTask) : undefined}
        onSave={saveTask}
        opened={taskFormOpen}
        pending={mutationPending}
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
              variant="subtle"
              color="gray"
              leftSection={<Sparkles size={16} />}
            >
              AI chat
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
                <TaskBoard
                  groupedTasks={groupedTasks}
                  onDelete={deleteTask}
                  onEdit={openEditTask}
                />
              ) : (
                <TaskList
                  tasks={tasks}
                  onDelete={deleteTask}
                  onEdit={openEditTask}
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

function TaskBoard({
  groupedTasks,
  onDelete,
  onEdit,
}: {
  groupedTasks: Record<TaskStatus, Task[]>;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2, xl: 5 }} spacing="md">
      {statusColumns.map((column) => (
        <Paper
          key={column.status}
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
              {groupedTasks[column.status].length}
            </Badge>
          </Group>

          <Stack gap="sm">
            {groupedTasks[column.status].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
            {groupedTasks[column.status].length === 0 ? (
              <Text size="sm" c="dimmed" py="md">
                No tasks
              </Text>
            ) : null}
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

function TaskCard({
  task,
  onDelete,
  onEdit,
}: {
  task: Task;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  return (
    <Paper withBorder radius="md" p="sm" className="task-card">
      <Stack gap={8}>
        <Group justify="space-between" gap="xs">
          <Badge color={priorityColor[task.priority]} variant="light">
            {task.priority}
          </Badge>
          <Group gap={4}>
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
    </Paper>
  );
}

function TaskList({
  tasks,
  onDelete,
  onEdit,
}: {
  tasks: Task[];
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
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
  error,
  form,
  mode,
  onChange,
  onClose,
  onDelete,
  onSave,
  opened,
  pending,
}: {
  error: string;
  form: TaskFormState;
  mode: 'create' | 'edit';
  onChange: (form: TaskFormState) => void;
  onClose: () => void;
  onDelete?: () => void;
  onSave: () => void;
  opened: boolean;
  pending: boolean;
}) {
  const update = <TKey extends keyof TaskFormState>(
    key: TKey,
    value: TaskFormState[TKey],
  ) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'create' ? 'New task' : 'Edit task'}
      centered
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
              onChange={(value) => update('issueType', value as IssueType)}
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
            max={99}
            min={0}
            value={form.storyPoints}
            onChange={(value) =>
              update('storyPoints', typeof value === 'number' ? value : '')
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

function formatError(error: unknown) {
  if (!error) {
    return '';
  }

  return error instanceof ApiClientError
    ? error.message
    : 'Unable to load workspace data.';
}

function taskFormToPayload(form: TaskFormState): CreateTaskRequest {
  return {
    title: form.title.trim(),
    description: form.description.trim() ? form.description.trim() : null,
    issueType: form.issueType,
    category: form.category,
    priority: form.priority,
    status: form.status,
    storyPoints: form.storyPoints === '' ? null : form.storyPoints,
  };
}
