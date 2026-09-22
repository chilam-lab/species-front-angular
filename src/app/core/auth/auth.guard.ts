import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/** Protege rutas que requieren sesión iniciada; valida contra el backend, no solo el estado local. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.checkSession().pipe(
    map((valid) => valid ? true : router.createUrlTree(['/login']))
  );
};
