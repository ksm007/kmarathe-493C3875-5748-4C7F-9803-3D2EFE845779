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
import type {
  AcceptanceCriteriaInput,
  CreateTaskRequest,
  Sprint,
  Task,
  UserSummary,
} from '@nx-temp/data';
import { IssueType, TaskCategory, TaskPriority, TaskStatus } from '@nx-temp/data';
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
