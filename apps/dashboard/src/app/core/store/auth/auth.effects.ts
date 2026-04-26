import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthStorageService } from '../../services/auth-storage.service';
import { ToastService } from '../../services/toast.service';
import { AuthActions } from './auth.actions';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly storage = inject(AuthStorageService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly hydrate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.hydrateSession),
      switchMap(() => {
        const session = this.storage.getSession();
        if (!session) {
          return of(AuthActions.hydrateFailure());
        }

        return this.api.me().pipe(
          map((user) => AuthActions.hydrateSuccess({ token: session.token, user })),
          catchError(() => of(AuthActions.hydrateFailure()))
        );
      })
    )
  );

  readonly login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginRequested),
      switchMap(({ credentials }) =>
        this.api.login(credentials).pipe(
          map((response) =>
            AuthActions.loginSuccess({
              token: response.accessToken,
              user: response.user,
            })
          ),
          catchError(() =>
            of(AuthActions.loginFailure({ error: 'Unable to sign in with those credentials.' }))
          )
        )
      )
    )
  );

  readonly persistSession$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.hydrateSuccess, AuthActions.loginSuccess),
        tap(({ token, user }) => {
          this.storage.saveSession(token, user);
        })
      ),
    { dispatch: false }
  );

  readonly loginRedirect$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(({ user }) => {
          this.toast.success('Signed in', `Welcome back, ${user.fullName}.`);
          void this.router.navigateByUrl('/tasks');
        })
      ),
    { dispatch: false }
  );

  readonly clearSession$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.hydrateFailure, AuthActions.logoutRequested),
        tap(() => {
          this.storage.clear();
        })
      ),
    { dispatch: false }
  );

  readonly logoutRedirect$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutRequested),
        tap(() => {
          this.toast.info('Signed out', 'Your session has ended.');
          void this.router.navigateByUrl('/login');
        })
      ),
    { dispatch: false }
  );

  readonly loginFailureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginFailure),
        tap(({ error }) => {
          this.toast.error('Sign in failed', error);
        })
      ),
    { dispatch: false }
  );
}
