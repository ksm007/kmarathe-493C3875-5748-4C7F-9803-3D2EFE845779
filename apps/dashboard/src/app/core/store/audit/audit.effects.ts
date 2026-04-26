import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { AuditActions } from './audit.actions';

@Injectable()
export class AuditEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuditActions.loadRequested),
      switchMap(({ limit }) =>
        this.api.listAuditLog(limit).pipe(
          map((entries) => AuditActions.loadSuccess({ entries })),
          catchError(() => {
            this.toast.error('Audit log unavailable', 'Unable to load audit log.');
            return of(AuditActions.loadFailure({ error: 'Unable to load audit log.' }));
          })
        )
      )
    )
  );
}
