import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';
import { authState } from '@angular/fire/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map((user) => {
      if (user) {
        return true;
      }
      
      // Store the attempted URL for redirecting after login
      router.navigate(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
      return false;
    })
  );
};

export const guestGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map((user) => {
      if (!user) {
        return true;
      }
      
      // User is already authenticated, redirect to dashboard
      router.navigate(['/dashboard']);
      return false;
    })
  );
};
