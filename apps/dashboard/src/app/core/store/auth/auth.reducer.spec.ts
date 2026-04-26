import { AuthActions } from './auth.actions';
import { authReducer } from './auth.reducer';

describe('authReducer', () => {
  it('stores the session after login success', () => {
    const state = authReducer(
      undefined,
      AuthActions.loginSuccess({
        token: 'token',
        user: {
          id: '1',
          email: 'owner@acme.test',
          fullName: 'Olivia Owner',
          role: 'owner',
          organizationId: 'org-1',
          organizationName: 'Acme HQ',
        },
      })
    );

    expect(state.token).toBe('token');
    expect(state.user?.email).toBe('owner@acme.test');
    expect(state.loading).toBe(false);
  });

  it('clears the session on logout', () => {
    const state = authReducer(
      {
        initialized: true,
        loading: false,
        token: 'token',
        user: {
          id: '1',
          email: 'owner@acme.test',
          fullName: 'Olivia Owner',
          role: 'owner',
          organizationId: 'org-1',
          organizationName: 'Acme HQ',
        },
        error: null,
      },
      AuthActions.logoutRequested()
    );

    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });
});
