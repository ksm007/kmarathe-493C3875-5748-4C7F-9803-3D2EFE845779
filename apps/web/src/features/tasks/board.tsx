import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
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
import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import type { ReorderTasksRequest, Task } from '@nx-temp/data';
import { TaskPriority, TaskStatus } from '@nx-temp/data';
import { Eye, GripVertical, Pencil, Trash2 } from 'lucide-react';

export const statusColumns = [
  { status: TaskStatus.Backlog, label: 'Backlog', color: 'gray' },
  { status: TaskStatus.Todo, label: 'Todo', color: 'blue' },
  { status: TaskStatus.InProgress, label: 'In progress', color: 'yellow' },
  { status: TaskStatus.InReview, label: 'Review', color: 'violet' },
  { status: TaskStatus.Done, label: 'Done', color: 'green' },
] as const;

export const priorityColor: Record<TaskPriority, string> = {
  [TaskPriority.Low]: 'gray',
  [TaskPriority.Medium]: 'blue',
  [TaskPriority.High]: 'red',
};

export function TaskBoard({
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
  const [localBoard, setLocalBoard] = useState<Record<
    TaskStatus,
    Task[]
  > | null>(null);
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

      return moveTaskInBoard(
        currentBoard,
        activeId,
        targetStatus,
        overTask?.id,
      );
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
    <Paper
      withBorder
      radius="md"
      p="sm"
      className="task-card task-card-overlay"
    >
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

const taskColumnHelper = createColumnHelper<Task>();

export function TaskList({
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
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      taskColumnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <>
            <Text fw={700} size="sm">
              {info.getValue()}
            </Text>
            <Text size="xs" c="dimmed">
              {info.row.original.issueType} in{' '}
              {info.row.original.organizationName}
            </Text>
          </>
        ),
      }),
      taskColumnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <Badge variant="light">{info.getValue()}</Badge>,
      }),
      taskColumnHelper.accessor('priority', {
        header: 'Priority',
        cell: (info) => (
          <Badge color={priorityColor[info.getValue()]} variant="light">
            {info.getValue()}
          </Badge>
        ),
      }),
      taskColumnHelper.accessor('assigneeName', {
        header: 'Assignee',
        cell: (info) => info.getValue() ?? 'Unassigned',
      }),
      taskColumnHelper.accessor('sprintName', {
        header: 'Sprint',
        cell: (info) => info.getValue() ?? 'Backlog',
      }),
      taskColumnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const task = info.row.original;
          return (
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
          );
        },
      }),
    ],
    [onDelete, onEdit, onOpenDetails],
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.Th
                    key={header.id}
                    style={
                      header.column.getCanSort()
                        ? { cursor: 'pointer', userSelect: 'none' }
                        : undefined
                    }
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() === 'asc'
                      ? ' ↑'
                      : header.column.getIsSorted() === 'desc'
                        ? ' ↓'
                        : null}
                  </Table.Th>
                ))}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {table.getRowModel().rows.map((row) => (
              <Table.Tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

export function groupTasksByStatus(tasks: Task[]) {
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

export function mergeReorderedTasks(
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

export function mergeTasks(currentTasks: Task[], updatedTasks: Task[]) {
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
