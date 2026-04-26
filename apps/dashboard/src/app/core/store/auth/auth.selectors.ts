import { createSelector } from '@ngrx/store';
import { selectToken, selectUser } from './auth.reducer';

export const selectIsAuthenticated = createSelector(
  selectToken,
  selectUser,
  (token, user) => Boolean(token && user)
);

export const selectCanViewAudit = createSelector(selectUser, (user) =>
  user ? user.role === 'owner' || user.role === 'admin' : false
);
