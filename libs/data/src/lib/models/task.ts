export enum TaskStatus {
  Backlog = 'backlog',
  Todo = 'todo',
  InProgress = 'in_progress',
  InReview = 'in_review',
  Done = 'done',
}

export enum IssueType {
  Task = 'task',
  Bug = 'bug',
  Story = 'story',
  Epic = 'epic',
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

export enum SprintState {
  Planned = 'planned',
  Active = 'active',
  Completed = 'completed',
}

export interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  state: SprintState;
  capacityPoints: number | null;
  startDate: string | null;
  endDate: string | null;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  issueType: IssueType;
  category: TaskCategory;
  priority: TaskPriority;
  storyPoints: number | null;
  sprintId: string | null;
  sprintName: string | null;
  parentEpicId: string | null;
  parentEpicTitle: string | null;
  acceptanceCriteria: AcceptanceCriteriaItem[];
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

export interface AcceptanceCriteriaItem {
  id: string;
  text: string;
  completed: boolean;
}

export enum TaskActivityType {
  TaskCreated = 'task_created',
  TaskUpdated = 'task_updated',
  StatusChanged = 'status_changed',
  EpicChanged = 'epic_changed',
  SprintChanged = 'sprint_changed',
  AcceptanceCriteriaChanged = 'acceptance_criteria_changed',
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
