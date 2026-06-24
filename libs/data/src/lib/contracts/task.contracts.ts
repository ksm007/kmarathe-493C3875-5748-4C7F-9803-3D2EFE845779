import {
  IssueType,
  SprintState,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '../models/task';

export interface AcceptanceCriteriaInput {
  id?: string;
  text: string;
  completed?: boolean;
}

export interface TaskQuery {
  status?: TaskStatus;
  category?: TaskCategory;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'priority' | 'position';
  order?: 'asc' | 'desc';
  organizationId?: string;
  sprintId?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  issueType?: IssueType;
  category: TaskCategory;
  priority: TaskPriority;
  storyPoints?: number | null;
  sprintId?: string | null;
  parentEpicId?: string | null;
  acceptanceCriteria?: AcceptanceCriteriaInput[];
  status?: TaskStatus;
  organizationId?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  issueType?: IssueType;
  category?: TaskCategory;
  priority?: TaskPriority;
  storyPoints?: number | null;
  sprintId?: string | null;
  parentEpicId?: string | null;
  acceptanceCriteria?: AcceptanceCriteriaInput[];
  status?: TaskStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
  tags?: string[];
}

export interface ReorderTaskItem {
  id: string;
  status: TaskStatus;
  position: number;
}

export interface ReorderTasksRequest {
  tasks: ReorderTaskItem[];
}

export interface AddTaskCommentRequest {
  message: string;
}

export interface SprintQuery {
  state?: SprintState;
  organizationId?: string;
}

export interface CreateSprintRequest {
  name: string;
  goal?: string | null;
  capacityPoints?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  organizationId?: string;
}

export interface UpdateSprintRequest {
  name?: string;
  goal?: string | null;
  capacityPoints?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CompleteSprintRequest {
  destinationSprintId?: string | null;
}
