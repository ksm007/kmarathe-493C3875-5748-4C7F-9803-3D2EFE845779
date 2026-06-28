import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import type { ChatMessage, PendingChatAction } from '@nx-temp/data';
import { Check, Lightbulb, MessageSquarePlus, Sparkles, X, Zap } from 'lucide-react';
import { apiClient } from '~/lib/api-client';
import { getStoredSession } from '~/lib/auth-storage';
import { formatError } from '~/lib/format';
import { queryClient } from '~/lib/query-client';
import { useCurrentUser } from '~/lib/use-current-user';

export const Route = createFileRoute('/_authed/ai-chat')({
  loader: () => {
    const session = getStoredSession();
    return queryClient.prefetchQuery({
      queryKey: [
        'chat-history',
        session?.user.id,
        session?.user.organizationId,
      ],
      queryFn: () => apiClient.chatHistory({ limit: 30 }),
    });
  },
  component: ChatRoute,
});

function ChatRoute() {
  const currentUser = useCurrentUser();
  const queryClientInstance = useQueryClient();
  const [message, setMessage] = useState('');
  const [streamedAnswer, setStreamedAnswer] = useState('');
  const [streamError, setStreamError] = useState('');

  const historyQuery = useQuery({
    queryKey: ['chat-history', currentUser.id, currentUser.organizationId],
    queryFn: () => apiClient.chatHistory({ limit: 30 }),
  });

  const refreshChatAndTasks = async () => {
    await Promise.all([
      queryClientInstance.invalidateQueries({ queryKey: ['chat-history'] }),
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] }),
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

  const quickActions = [
    { label: 'List all open tasks', prompt: 'List all tasks that are not yet done.' },
    { label: 'Summarize this sprint', prompt: 'Summarize the active sprint: tasks, progress, and blockers.' },
    { label: 'High priority tasks', prompt: 'Which tasks have high priority and are not yet done?' },
    { label: 'Overdue tasks', prompt: 'Are there any tasks with a due date that has already passed?' },
    { label: 'Create a task', prompt: 'Create a new task: ' },
    { label: 'Assign task', prompt: 'Assign task "" to ' },
  ];

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

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" style={{ alignItems: 'start' }}>
        <Box style={{ gridColumn: 'span 2' }}>
          <Stack gap="md">
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
                  <Text c="dimmed">No chat history. Use quick actions or type a question below.</Text>
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
                  <Group justify="space-between" align="center">
                    <Text size="xs" c="dimmed">
                      The AI can read your tasks and propose changes for your review.
                    </Text>
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
        </Box>

        <Stack gap="md">
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group gap="xs">
                <ThemeIcon size={28} radius="md" color="blue" variant="light">
                  <Zap size={14} />
                </ThemeIcon>
                <Text fw={700} size="sm">
                  Quick actions
                </Text>
              </Group>
              <Divider />
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="subtle"
                  size="xs"
                  fullWidth
                  justify="left"
                  leftSection={<MessageSquarePlus size={13} />}
                  onClick={() => setMessage(action.prompt)}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group gap="xs">
                <ThemeIcon size={28} radius="md" color="yellow" variant="light">
                  <Lightbulb size={14} />
                </ThemeIcon>
                <Text fw={700} size="sm">
                  Tips
                </Text>
              </Group>
              <Divider />
              <Stack gap="xs">
                {[
                  'Be specific: "Create a bug for login failing on mobile" works better than "create a task".',
                  'The AI sees all tasks in your organization.',
                  'Changes are staged for confirmation - you approve before anything is saved.',
                  'Ask for summaries: "Summarize high priority tasks for this sprint."',
                ].map((tip, i) => (
                  <Text key={i} size="xs" c="dimmed" lh={1.5}>
                    {tip}
                  </Text>
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </SimpleGrid>
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
              <Tooltip
                key={source.taskId}
                label={`Similarity: ${Math.round(source.similarity * 100)}%`}
                withArrow
              >
                <Link
                  to="/tasks/$id"
                  params={{ id: source.taskId }}
                  style={{ textDecoration: 'none' }}
                >
                  <Badge variant="outline" style={{ cursor: 'pointer' }}>
                    {source.title}{' '}
                    <Text span size="xs" c="dimmed">
                      {Math.round(source.similarity * 100)}%
                    </Text>
                  </Badge>
                </Link>
              </Tooltip>
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
