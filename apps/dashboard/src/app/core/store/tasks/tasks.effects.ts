import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, concatMap, map, of, switchMap, take, tap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { TasksActions } from './tasks.actions';
import { selectTaskQuery } from './tasks.reducer';

@Injectable()
export class TasksEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly store = inject(Store);
  private readonly toast = inject(ToastService);

  readonly queryChanged$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.queryChanged),
      map(({ query }) => TasksActions.loadRequested({ query }))
    )
  );

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.loadRequested),
      switchMap(({ query }) =>
        this.api.listTasks(query).pipe(
          map((tasks) => TasksActions.loadSuccess({ tasks, query })),
          catchError(() => {
            this.toast.error('Tasks unavailable', 'Unable to load tasks.');
            return of(TasksActions.loadFailure({ error: 'Unable to load tasks.' }));
          })
        )
      )
    )
  );

  readonly create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.createRequested),
      concatMap(({ payload }) =>
        this.api.createTask(payload).pipe(
          tap(() => {
            this.toast.success('Task created', 'The task was added to the board.');
          }),
          switchMap(() => this.reloadCurrentQuery()),
          catchError(() => {
            this.toast.error('Create failed', 'Unable to save task changes.');
            return of(TasksActions.loadFailure({ error: 'Unable to save task changes.' }));
          })
        )
      )
    )
  );

  readonly update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.updateRequested),
      concatMap(({ id, payload }) =>
        this.api.updateTask(id, payload).pipe(
          tap(() => {
            this.toast.success('Task updated', 'The task changes were saved.');
          }),
          switchMap(() => this.reloadCurrentQuery()),
          catchError(() => {
            this.toast.error('Update failed', 'Unable to save task changes.');
            return of(TasksActions.loadFailure({ error: 'Unable to save task changes.' }));
          })
        )
      )
    )
  );

  readonly delete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.deleteRequested),
      concatMap(({ id }) =>
        this.api.deleteTask(id).pipe(
          tap(() => {
            this.toast.success('Task deleted', 'The task was removed.');
          }),
          switchMap(() => this.reloadCurrentQuery()),
          catchError(() => {
            this.toast.error('Delete failed', 'Unable to save task changes.');
            return of(TasksActions.loadFailure({ error: 'Unable to save task changes.' }));
          })
        )
      )
    )
  );

  readonly reorder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.reorderRequested),
      concatMap(({ payload }) =>
        this.api.reorderTasks(payload).pipe(
          tap(() => {
            this.toast.success('Board updated', 'Task order and status were saved.');
          }),
          switchMap(() => this.reloadCurrentQuery()),
          catchError(() => {
            this.toast.error('Reorder failed', 'Unable to save task changes.');
            return of(TasksActions.loadFailure({ error: 'Unable to save task changes.' }));
          })
        )
      )
    )
  );

  private reloadCurrentQuery() {
    return this.store.select(selectTaskQuery).pipe(
      take(1),
      map((query) => TasksActions.loadRequested({ query }))
    );
  }
}
