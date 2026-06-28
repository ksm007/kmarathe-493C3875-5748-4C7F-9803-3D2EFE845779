import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm, useStore } from '@tanstack/react-form';
import type {
  AcceptanceCriteriaInput,
  CreateTaskRequest,
  Sprint,
  Task,
  UserSummary,
} from '@nx-temp/data';
import {
  IssueType,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@nx-temp/data';
import { Trash2 } from 'lucide-react';
import { statusColumns } from './board';

export interface TaskFormState {
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

export const emptyTaskForm: TaskFormState = {
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

export function TaskFormModal({
  assignableUsers,
  editingTask,
  epicOptions,
  error,
  defaultValues,
  mode,
  onClose,
  onDelete,
  onSave,
  opened,
  pending,
  sprintOptions,
}: {
  assignableUsers: UserSummary[];
  editingTask: Task | null;
  epicOptions: Task[];
  error: string;
  defaultValues: TaskFormState;
  mode: 'create' | 'edit';
  onClose: () => void;
  onDelete?: () => void;
  onSave: (payload: CreateTaskRequest) => void;
  opened: boolean;
  pending: boolean;
  sprintOptions: Sprint[];
}) {
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      onSave(taskFormToPayload(value, editingTask));
    },
  });

  const issueType = useStore(form.store, (s) => s.values.issueType);
  const epicDisabled = issueType === IssueType.Epic;

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
          void form.handleSubmit();
        }}
      >
        <Stack gap="md">
          <form.Field
            name="title"
            validators={{
              onSubmit: ({ value }) =>
                !value.trim() ? 'Title is required' : undefined,
            }}
          >
            {(field) => (
              <TextInput
                label="Title"
                maxLength={160}
                required
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
              />
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <Textarea
                autosize
                label="Description"
                maxLength={2000}
                minRows={3}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            )}
          </form.Field>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <form.Field name="issueType">
              {(field) => (
                <Select
                  allowDeselect={false}
                  label="Type"
                  data={[
                    { value: IssueType.Task, label: 'Task' },
                    { value: IssueType.Bug, label: 'Bug' },
                    { value: IssueType.Story, label: 'Story' },
                    { value: IssueType.Epic, label: 'Epic' },
                  ]}
                  value={field.state.value}
                  onChange={(value) => {
                    const nextType = value as IssueType;
                    field.handleChange(nextType);
                    if (nextType === IssueType.Epic) {
                      form.setFieldValue('parentEpicId', '');
                      form.setFieldValue('sprintId', '');
                    }
                  }}
                />
              )}
            </form.Field>

            <form.Field name="status">
              {(field) => (
                <Select
                  allowDeselect={false}
                  label="Status"
                  data={statusColumns.map((column) => ({
                    value: column.status,
                    label: column.label,
                  }))}
                  value={field.state.value}
                  onChange={(value) => field.handleChange(value as TaskStatus)}
                />
              )}
            </form.Field>

            <form.Field name="category">
              {(field) => (
                <Select
                  allowDeselect={false}
                  label="Category"
                  data={[
                    { value: TaskCategory.Work, label: 'Work' },
                    { value: TaskCategory.Personal, label: 'Personal' },
                    { value: TaskCategory.Ops, label: 'Ops' },
                  ]}
                  value={field.state.value}
                  onChange={(value) =>
                    field.handleChange(value as TaskCategory)
                  }
                />
              )}
            </form.Field>

            <form.Field name="priority">
              {(field) => (
                <Select
                  allowDeselect={false}
                  label="Priority"
                  data={[
                    { value: TaskPriority.Low, label: 'Low' },
                    { value: TaskPriority.Medium, label: 'Medium' },
                    { value: TaskPriority.High, label: 'High' },
                  ]}
                  value={field.state.value}
                  onChange={(value) =>
                    field.handleChange(value as TaskPriority)
                  }
                />
              )}
            </form.Field>
          </SimpleGrid>

          <form.Field name="storyPoints">
            {(field) => (
              <NumberInput
                allowDecimal={false}
                allowNegative={false}
                label="Story points"
                max={40}
                min={0}
                value={field.state.value}
                onChange={(value) =>
                  field.handleChange(
                    typeof value === 'number' ? value : '',
                  )
                }
              />
            )}
          </form.Field>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <form.Field name="parentEpicId">
              {(field) => (
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
                  value={field.state.value || null}
                  onChange={(value) => field.handleChange(value ?? '')}
                />
              )}
            </form.Field>

            <form.Field name="sprintId">
              {(field) => (
                <Select
                  clearable
                  data={sprintOptions.map((sprint) => ({
                    value: sprint.id,
                    label: `${sprint.name} - ${sprint.state}`,
                  }))}
                  disabled={epicDisabled}
                  label="Sprint"
                  placeholder={epicDisabled ? 'Epics stay in backlog' : 'Backlog'}
                  value={field.state.value || null}
                  onChange={(value) => field.handleChange(value ?? '')}
                />
              )}
            </form.Field>

            <form.Field name="assigneeId">
              {(field) => (
                <Select
                  clearable
                  data={assignableUsers.map((user) => ({
                    value: user.id,
                    label: `${user.fullName} - ${user.organizationName}`,
                  }))}
                  label="Assignee"
                  placeholder="Unassigned"
                  value={field.state.value || null}
                  onChange={(value) => field.handleChange(value ?? '')}
                />
              )}
            </form.Field>

            <form.Field name="dueDate">
              {(field) => (
                <TextInput
                  label="Due date"
                  type="date"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              )}
            </form.Field>
          </SimpleGrid>

          <form.Field name="tagsText">
            {(field) => (
              <TextInput
                label="Tags"
                placeholder="security, auth, sprint-12"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

          <form.Field name="acceptanceCriteriaText">
            {(field) => (
              <Textarea
                autosize
                label="Acceptance criteria"
                maxLength={4800}
                minRows={3}
                placeholder="One criterion per line"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>

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

export function taskFormToPayload(
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
