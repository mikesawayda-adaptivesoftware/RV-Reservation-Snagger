import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="success-page">
      <div class="success-card">
        <div class="success-icon">🎉</div>
        <h1>Welcome to Premium!</h1>
        <p>Your subscription is now active. You can now create more alerts and get faster notifications.</p>
        <div class="actions">
          <a routerLink="/dashboard" class="btn btn-primary">Go to Dashboard</a>
          <a routerLink="/alerts/new" class="btn btn-secondary">Create an Alert</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .success-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
      padding: 2rem;
    }
    .success-card {
      background: white;
      padding: 3rem;
      border-radius: 16px;
      text-align: center;
      max-width: 500px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .success-icon { font-size: 5rem; margin-bottom: 1rem; }
    h1 { color: #2E7D32; margin-bottom: 1rem; }
    p { color: #666; margin-bottom: 2rem; line-height: 1.6; }
    .actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn { padding: 0.875rem 1.5rem; border-radius: 8px; font-weight: 600; text-decoration: none; }
    .btn-primary { background: #2E7D32; color: white; }
    .btn-secondary { background: #E8F5E9; color: #2E7D32; }
  `],
})
export class SuccessComponent {}
