import { AuditLogEntry } from '@nx-temp/data';
import { createActionGroup, props } from '@ngrx/store';

export const AuditActions = createActionGroup({
  source: 'Audit',
  events: {
    'Load Requested': props<{ limit?: number }>(),
    'Load Success': props<{ entries: AuditLogEntry[] }>(),
    'Load Failure': props<{ error: string }>(),
  },
});
