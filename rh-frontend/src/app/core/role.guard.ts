import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Role } from './models';

export const roleGuard = (roles: Role[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.user?.role;
    if (!role || !roles.includes(role)) {
      void router.navigateByUrl('/dashboard');
      return false;
    }
    return true;
  };
};
