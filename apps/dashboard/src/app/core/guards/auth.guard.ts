import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthStorageService } from '../services/auth-storage.service';

export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const storage = inject(AuthStorageService);
  const router = inject(Router);

  return storage.getToken() ? true : router.createUrlTree(['/login']);
};
