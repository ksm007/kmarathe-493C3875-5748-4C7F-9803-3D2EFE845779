import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  FileInput,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TaskActivity,
  TaskAttachment,
  TaskDetail,
} from '@nx-temp/data';
import {
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { apiClient } from '~/lib/api-client';
import { formatBytes, formatError } from '~/lib/format';
import { priorityColor } from './board';

/**
 * Task detail modal rendered by the `/tasks/$id` route. The route owns the
 * detail data contract (it prefetches `['task-detail', taskId]` in its loader);
 * this component reads the same cache key and closes by navigating back to the
 * board via `onClose`.
 */
export function TaskDetailModal({
  taskId,
  onClose,
  onTasksChanged,
}: {
  taskId: string;
  onClose: () => void;
  onTasksChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  useEffect(() => {
    setComment('');
    setAttachment(null);
  }, [taskId]);

  const detailQuery = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: () => apiClient.getTaskDetail(taskId),
  });

  const refreshDetail = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] }),
      onTasksChanged(),
    ]);
  };

  const commentMutation = useMutation({
    mutationFn: (message: string) =>
      apiClient.addTaskComment(taskId, { message }),
    onSuccess: async () => {
      setComment('');
      await refreshDetail();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => apiClient.uploadTaskAttachment(taskId, file),
    onSuccess: async () => {
      setAttachment(null);
      await refreshDetail();
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      apiClient.deleteTaskAttachment(taskId, attachmentId),
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
      opened
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
