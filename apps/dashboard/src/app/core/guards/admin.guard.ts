import { Role } from '@nx-temp/data';
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthStorageService } from '../services/auth-storage.service';

export const adminGuard: CanActivateFn = (): boolean | UrlTree => {
  const storage = inject(AuthStorageService);
  const router = inject(Router);
  const session = storage.getSession();

  if (!session) {
    return router.createUrlTree(['/login']);
  }

  return session.user.role === Role.Admin || session.user.role === Role.Owner
    ? true
    : router.createUrlTree(['/tasks']);
};
