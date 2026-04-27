export enum TaskStatus {
  Todo = 'todo',
  InProgress = 'in_progress',
  Done = 'done',
}

export enum TaskCategory {
  Work = 'work',
  Personal = 'personal',
  Ops = 'ops',
}

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  category: TaskCategory;
  priority: TaskPriority;
  position: number;
  organizationId: string;
  organizationName: string;
  createdById: string;
  createdByName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export enum TaskActivityType {
  TaskCreated = 'task_created',
  TaskUpdated = 'task_updated',
  StatusChanged = 'status_changed',
  Comment = 'comment',
}

export interface TaskActivity {
  id: string;
  taskId: string;
  organizationId: string;
  actorId: string | null;
  actorName: string | null;
  type: TaskActivityType;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TaskDetail extends Task {
  activities: TaskActivity[];
}
