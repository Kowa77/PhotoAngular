// src/app/auth/admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map } from 'rxjs/operators';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getCurrentUserEmail().pipe(
    map(email => {
      if (email === 'admin@gmail.com') {
        return true; // ✅ tiene permiso
      } else {
        router.navigate(['/']); // 🚫 redirige al home
        return false;
      }
    })
  );
};
