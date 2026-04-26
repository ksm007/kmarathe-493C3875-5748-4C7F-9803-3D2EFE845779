import { TaskCategory, TaskPriority, TaskStatus } from '../models/task';

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
  category: TaskCategory;
  priority: TaskPriority;
  status?: TaskStatus;
  organizationId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
}

export interface ReorderTaskItem {
  id: string;
  status: TaskStatus;
  position: number;
}

export interface ReorderTasksRequest {
  tasks: ReorderTaskItem[];
}
