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
  createdAt: string;
  updatedAt: string;
}
