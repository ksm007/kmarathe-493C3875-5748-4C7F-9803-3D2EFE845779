export enum Role {
  Owner = 'owner',
  Admin = 'admin',
  Viewer = 'viewer',
}

export enum Permission {
  TaskRead = 'task:read',
  TaskCreate = 'task:create',
  TaskUpdate = 'task:update',
  TaskDelete = 'task:delete',
  TaskReorder = 'task:reorder',
  AuditRead = 'audit:read',
  UserManage = 'user:manage',
}
