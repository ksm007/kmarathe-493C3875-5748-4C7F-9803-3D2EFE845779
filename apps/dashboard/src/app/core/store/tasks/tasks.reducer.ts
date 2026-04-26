import { Task, TaskQuery } from '@nx-temp/data';
import { createFeature, createReducer, on } from '@ngrx/store';
import { TasksActions } from './tasks.actions';

export interface TasksState {
  items: Task[];
  loading: boolean;
  query: TaskQuery;
  error: string | null;
}

const initialState: TasksState = {
  items: [],
  loading: false,
  query: {
    sortBy: 'position',
    order: 'asc',
  },
  error: null,
};

export const tasksFeature = createFeature({
  name: 'tasks',
  reducer: createReducer(
    initialState,
    on(TasksActions.queryChanged, (state, { query }) => ({ ...state, query })),
    on(TasksActions.loadRequested, (state, { query }) => ({
      ...state,
      loading: true,
      query,
      error: null,
    })),
    on(TasksActions.loadSuccess, (state, { tasks, query }) => ({
      ...state,
      items: tasks,
      query,
      loading: false,
      error: null,
    })),
    on(TasksActions.loadFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),
    on(
      TasksActions.createRequested,
      TasksActions.updateRequested,
      TasksActions.deleteRequested,
      TasksActions.reorderRequested,
      (state) => ({
        ...state,
        loading: true,
        error: null,
      })
    )
  ),
});

export const {
  reducer: tasksReducer,
  selectItems,
  selectLoading: selectTasksLoading,
  selectQuery: selectTaskQuery,
  selectError: selectTasksError,
} = tasksFeature;
