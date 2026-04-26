import { SetMetadata } from '@nestjs/common';
import { Permission } from '@nx-temp/data';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const PUBLIC_ROUTE_KEY = 'publicRoute';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
