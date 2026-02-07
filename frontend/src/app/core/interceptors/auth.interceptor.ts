import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { from, switchMap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);

  // Skip auth header for public endpoints
  if (req.url.includes('/pricing') || req.url.includes('/health')) {
    return next(req);
  }

  return from(getIdToken(auth)).pipe(
    switchMap((token) => {
      if (token) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        return next(authReq);
      }
      return next(req);
    })
  );
};

async function getIdToken(auth: Auth): Promise<string | null> {
  const user = auth.currentUser;
  if (user) {
    return user.getIdToken();
  }
  return null;
}
