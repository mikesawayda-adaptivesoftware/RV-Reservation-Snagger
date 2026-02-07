import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
      },
    ],
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'alerts',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/alerts/alerts-list/alerts-list.component').then(m => m.AlertsListComponent),
      },
      {
        path: 'new',
        loadComponent: () => import('./features/alerts/alert-create/alert-create.component').then(m => m.AlertCreateComponent),
      },
      {
        path: ':id',
        loadComponent: () => import('./features/alerts/alert-detail/alert-detail.component').then(m => m.AlertDetailComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./features/alerts/alert-edit/alert-edit.component').then(m => m.AlertEditComponent),
      },
    ],
  },
  {
    path: 'subscription',
    children: [
      {
        path: 'pricing',
        loadComponent: () => import('./features/subscription/pricing/pricing.component').then(m => m.PricingComponent),
      },
      {
        path: 'success',
        canActivate: [authGuard],
        loadComponent: () => import('./features/subscription/success/success.component').then(m => m.SuccessComponent),
      },
      {
        path: 'cancel',
        loadComponent: () => import('./features/subscription/cancel/cancel.component').then(m => m.CancelComponent),
      },
    ],
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
