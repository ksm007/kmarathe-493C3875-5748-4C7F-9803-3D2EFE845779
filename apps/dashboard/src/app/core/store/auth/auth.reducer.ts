import { CurrentUser } from '@nx-temp/data';
import { createFeature, createReducer, on } from '@ngrx/store';
import { AuthActions } from './auth.actions';

export interface AuthState {
  initialized: boolean;
  loading: boolean;
  token: string | null;
  user: CurrentUser | null;
  error: string | null;
}

const initialState: AuthState = {
  initialized: false,
  loading: false,
  token: null,
  user: null,
  error: null,
};

export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialState,
    on(AuthActions.hydrateSession, (state) => ({ ...state, loading: true })),
    on(AuthActions.hydrateSuccess, (state, { token, user }) => ({
      ...state,
      initialized: true,
      loading: false,
      token,
      user,
      error: null,
    })),
    on(AuthActions.hydrateFailure, () => ({ ...initialState, initialized: true })),
    on(AuthActions.loginRequested, (state) => ({ ...state, loading: true, error: null })),
    on(AuthActions.loginSuccess, (state, { token, user }) => ({
      ...state,
      initialized: true,
      loading: false,
      token,
      user,
      error: null,
    })),
    on(AuthActions.loginFailure, (state, { error }) => ({
      ...state,
      initialized: true,
      loading: false,
      error,
    })),
    on(AuthActions.logoutRequested, () => ({ ...initialState, initialized: true }))
  ),
});

export const {
  reducer: authReducer,
  selectError,
  selectInitialized,
  selectLoading,
  selectToken,
  selectUser,
} = authFeature;
