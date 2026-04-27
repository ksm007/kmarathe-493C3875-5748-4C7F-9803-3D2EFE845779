import { Permission, Role } from '@nx-temp/data';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.Owner]: [
    Permission.TaskRead,
    Permission.TaskCreate,
    Permission.TaskUpdate,
    Permission.TaskDelete,
    Permission.TaskReorder,
    Permission.AuditRead,
    Permission.UserManage,
  ],
  [Role.Admin]: [
    Permission.TaskRead,
    Permission.TaskCreate,
    Permission.TaskUpdate,
    Permission.TaskDelete,
    Permission.TaskReorder,
    Permission.AuditRead,
    Permission.UserManage,
  ],
  [Role.Viewer]: [Permission.TaskRead],
};

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return getRolePermissions(role).includes(permission);
}
