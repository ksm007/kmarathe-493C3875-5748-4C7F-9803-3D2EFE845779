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
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import type { ChatMessage, PendingChatAction } from '@nx-temp/data';
import { Check, Sparkles, X } from 'lucide-react';
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
              <Link
                key={source.taskId}
                to="/tasks/$id"
                params={{ id: source.taskId }}
                style={{ textDecoration: 'none' }}
              >
                <Badge variant="outline" style={{ cursor: 'pointer' }}>
                  {source.title}
                </Badge>
              </Link>
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
