export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  organizationId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  allowed: boolean;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
