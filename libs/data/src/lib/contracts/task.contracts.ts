import {
  IssueType,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '../models/task';

export interface TaskQuery {
  status?: TaskStatus;
  category?: TaskCategory;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'priority' | 'position';
  order?: 'asc' | 'desc';
  organizationId?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  issueType?: IssueType;
  category: TaskCategory;
  priority: TaskPriority;
  storyPoints?: number | null;
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
