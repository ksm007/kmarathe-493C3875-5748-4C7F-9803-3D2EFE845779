import { AuditLogEntry } from '@nx-temp/data';
import { createFeature, createReducer, on } from '@ngrx/store';
import { AuditActions } from './audit.actions';

export interface AuditState {
  entries: AuditLogEntry[];
  loading: boolean;
  error: string | null;
}

const initialState: AuditState = {
  entries: [],
  loading: false,
  error: null,
};

export const auditFeature = createFeature({
  name: 'audit',
  reducer: createReducer(
    initialState,
    on(AuditActions.loadRequested, (state) => ({ ...state, loading: true, error: null })),
    on(AuditActions.loadSuccess, (state, { entries }) => ({
      ...state,
      entries,
      loading: false,
      error: null,
    })),
    on(AuditActions.loadFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    }))
  ),
});

export const {
  reducer: auditReducer,
  selectEntries,
  selectLoading: selectAuditLoading,
  selectError: selectAuditError,
} = auditFeature;
