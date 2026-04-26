import { CurrentUser, LoginRequest } from '@nx-temp/data';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Hydrate Session': emptyProps(),
    'Hydrate Success': props<{ token: string; user: CurrentUser }>(),
    'Hydrate Failure': emptyProps(),
    'Login Requested': props<{ credentials: LoginRequest }>(),
    'Login Success': props<{ token: string; user: CurrentUser }>(),
    'Login Failure': props<{ error: string }>(),
    'Logout Requested': emptyProps(),
  },
});
