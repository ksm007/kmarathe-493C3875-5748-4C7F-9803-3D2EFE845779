import {
  CreateTaskRequest,
  ReorderTasksRequest,
  Task,
  TaskQuery,
  UpdateTaskRequest,
} from '@nx-temp/data';
import { createActionGroup, props } from '@ngrx/store';

export const TasksActions = createActionGroup({
  source: 'Tasks',
  events: {
    'Query Changed': props<{ query: TaskQuery }>(),
    'Load Requested': props<{ query: TaskQuery }>(),
    'Load Success': props<{ tasks: Task[]; query: TaskQuery }>(),
    'Load Failure': props<{ error: string }>(),
    'Create Requested': props<{ payload: CreateTaskRequest }>(),
    'Update Requested': props<{ id: string; payload: UpdateTaskRequest }>(),
    'Delete Requested': props<{ id: string }>(),
    'Reorder Requested': props<{ payload: ReorderTasksRequest }>(),
  },
});
