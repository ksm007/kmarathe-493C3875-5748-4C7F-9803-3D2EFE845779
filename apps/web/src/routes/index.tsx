import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  MessageSquare,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { getStoredSession } from '~/lib/auth-storage';

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: () => {
    if (getStoredSession()) {
      throw redirect({ to: '/tasks' });
    }
  },
  component: LandingPage,
});

const features = [
  {
    icon: ClipboardList,
    title: 'Multi-org ready',
    description:
      'Run multiple client organizations from one account. Tenant data stays isolated.',
  },
  {
    icon: Zap,
    title: 'Sprints and epics',
    description:
      'Full sprint lifecycle - plan, activate, complete - with backlog and epic grouping.',
  },
  {
    icon: Sparkles,
    title: 'AI-assisted tasks',
    description:
      'Ask the AI assistant to create, update, or summarize tasks. Confirm before changes apply.',
  },
  {
    icon: BarChart2,
    title: 'Analytics at a glance',
    description:
      'Stat cards and a priority breakdown chart give you board health in seconds.',
  },
  {
    icon: Shield,
    title: 'Role-based access',
    description:
      'Owner, Admin, and Viewer roles enforce the right permissions across every action.',
  },
  {
    icon: MessageSquare,
    title: 'Activity stream',
    description:
      'Comments, status changes, assignee updates, and story-point edits all logged per task.',
  },
];

const rbacMatrix = [
  {
    action: 'View tasks',
    owner: true,
    admin: true,
    viewer: true,
  },
  {
    action: 'Create / edit tasks',
    owner: true,
    admin: true,
    viewer: false,
  },
  {
    action: 'Delete tasks',
    owner: true,
    admin: true,
    viewer: false,
  },
  {
    action: 'Reorder board',
    owner: true,
    admin: true,
    viewer: false,
  },
  {
    action: 'Manage sprints',
    owner: true,
    admin: true,
    viewer: false,
  },
  {
    action: 'Invite members',
    owner: true,
    admin: true,
    viewer: false,
  },
  {
    action: 'Remove Admins/Viewers',
    owner: true,
    admin: true,
    viewer: false,
  },
  {
    action: 'Remove Owners',
    owner: true,
    admin: false,
    viewer: false,
  },
  {
    action: 'View audit log',
    owner: true,
    admin: true,
    viewer: false,
  },
];

function Check({ yes }: { yes: boolean }) {
  return yes ? (
    <CheckCircle2 size={18} color="var(--mantine-color-green-6)" />
  ) : (
    <Text c="dimmed" size="sm">
      -
    </Text>
  );
}

function LandingPage() {
  return (
    <Box style={{ minHeight: '100vh', background: '#f7f8fb' }}>
      {/* Nav */}
      <Box
        style={{
          borderBottom: '1px solid var(--mantine-color-gray-2)',
          background: '#fff',
        }}
      >
        <Container size="xl">
          <Group justify="space-between" py="md">
            <Group gap="sm">
              <ThemeIcon size={36} radius="md" color="blue">
                <ClipboardList size={18} aria-hidden="true" />
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={700}>
                  Stride
                </Text>
                <Text size="xs" c="dimmed">
                  SaaS work management
                </Text>
              </Box>
            </Group>
            <Group gap="sm">
              <Button variant="subtle" component={Link} to="/login">
                Sign in
              </Button>
              <Button component={Link} to="/signup">
                Get started
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Hero */}
      <Box
        style={{
          background:
            'linear-gradient(180deg, rgba(37,99,235,0.07) 0%, rgba(37,99,235,0) 100%)',
          paddingBottom: 80,
        }}
      >
        <Container size="lg" py={80}>
          <Center>
            <Stack align="center" maw={720} gap="xl">
              <Badge size="lg" variant="light" color="blue" radius="xl">
                Multi-tenant SaaS v1
              </Badge>
              <Title
                order={1}
                ta="center"
                style={{
                  fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                  lineHeight: 1.1,
                }}
              >
                Plan sprints, manage issues, and keep tenant data separated.
              </Title>
              <Text size="xl" c="dimmed" ta="center" lh={1.7} maw={600}>
                Stride gives each client organization its own workspace - tasks,
                sprints, team, and AI chat - while you manage them all from a
                single login.
              </Text>
              <Group gap="md">
                <Button
                  size="lg"
                  component={Link}
                  to="/signup"
                  rightSection={<ArrowRight size={18} />}
                >
                  Create a workspace
                </Button>
                <Button
                  size="lg"
                  variant="default"
                  component={Link}
                  to="/login"
                >
                  Sign in
                </Button>
              </Group>
            </Stack>
          </Center>
        </Container>
      </Box>

      {/* Features */}
      <Container size="xl" py={60}>
        <Stack gap="xl">
          <Center>
            <Stack align="center" gap="xs" maw={560}>
              <Title order={2} ta="center">
                Everything your team needs
              </Title>
              <Text c="dimmed" ta="center">
                All the features to run sprints, issues, and team collaboration
                in one place.
              </Text>
            </Stack>
          </Center>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {features.map((feature) => (
              <Paper
                key={feature.title}
                withBorder
                radius="md"
                p="lg"
                style={{ background: '#fff' }}
              >
                <Stack gap="sm">
                  <ThemeIcon size={44} radius="md" color="blue" variant="light">
                    <feature.icon size={22} aria-hidden="true" />
                  </ThemeIcon>
                  <Text fw={700}>{feature.title}</Text>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {feature.description}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>

      <Divider />

      {/* RBAC matrix */}
      <Container size="lg" py={60}>
        <Stack gap="xl">
          <Center>
            <Stack align="center" gap="xs" maw={560}>
              <Title order={2} ta="center">
                Role-based access control
              </Title>
              <Text c="dimmed" ta="center">
                Every action is gated by role. Assign the right level of access
                to every team member.
              </Text>
            </Stack>
          </Center>

          <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
            <Table.ScrollContainer minWidth={500}>
              <Table verticalSpacing="sm" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>
                      <Group gap="xs">
                        <Users size={14} />
                        Owner
                      </Group>
                    </Table.Th>
                    <Table.Th>
                      <Group gap="xs">
                        <Shield size={14} />
                        Admin
                      </Group>
                    </Table.Th>
                    <Table.Th>
                      <Group gap="xs">
                        <ListChecks size={14} />
                        Viewer
                      </Group>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rbacMatrix.map((row) => (
                    <Table.Tr key={row.action}>
                      <Table.Td>
                        <Text size="sm">{row.action}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Check yes={row.owner} />
                      </Table.Td>
                      <Table.Td>
                        <Check yes={row.admin} />
                      </Table.Td>
                      <Table.Td>
                        <Check yes={row.viewer} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </Stack>
      </Container>

      <Divider />

      {/* CTA */}
      <Box
        style={{
          background: 'linear-gradient(135deg, #102033 0%, #1a3a5c 100%)',
          color: '#fff',
        }}
        py={80}
      >
        <Container size="md">
          <Center>
            <Stack align="center" gap="xl" maw={560}>
              <Title order={2} ta="center" c="white">
                Ready to organize your team?
              </Title>
              <Text ta="center" c="gray.3" size="lg" lh={1.7}>
                Create a workspace in seconds. Invite your team, set up sprints,
                and start moving work forward.
              </Text>
              <Group gap="md">
                <Button
                  size="lg"
                  variant="white"
                  color="dark"
                  component={Link}
                  to="/signup"
                  rightSection={<ArrowRight size={18} />}
                >
                  Create a free workspace
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  color="gray.4"
                  component={Link}
                  to="/login"
                >
                  Sign in
                </Button>
              </Group>
            </Stack>
          </Center>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        style={{
          borderTop: '1px solid var(--mantine-color-gray-2)',
          background: '#fff',
        }}
        py="xl"
      >
        <Container size="xl">
          <Group justify="space-between" wrap="wrap" gap="md">
            <Group gap="sm">
              <ThemeIcon size={28} radius="md" color="blue" variant="light">
                <ClipboardList size={14} aria-hidden="true" />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Stride
              </Text>
            </Group>
            <Group gap="lg">
              <Anchor component={Link} to="/login" size="sm" c="dimmed">
                Sign in
              </Anchor>
              <Anchor component={Link} to="/signup" size="sm" c="dimmed">
                Create workspace
              </Anchor>
            </Group>
            <Text size="xs" c="dimmed">
              &copy; 2026 Stride. All rights reserved.
            </Text>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
