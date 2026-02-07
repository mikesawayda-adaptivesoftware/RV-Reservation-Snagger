import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cancel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="cancel-page">
      <div class="cancel-card">
        <div class="cancel-icon">😕</div>
        <h1>Subscription Cancelled</h1>
        <p>No worries! You can still use the free tier or come back anytime to upgrade.</p>
        <div class="actions">
          <a routerLink="/dashboard" class="btn btn-primary">Go to Dashboard</a>
          <a routerLink="/subscription/pricing" class="btn btn-secondary">View Plans</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cancel-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
      padding: 2rem;
    }
    .cancel-card {
      background: white;
      padding: 3rem;
      border-radius: 16px;
      text-align: center;
      max-width: 500px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .cancel-icon { font-size: 5rem; margin-bottom: 1rem; }
    h1 { color: #1a1a1a; margin-bottom: 1rem; }
    p { color: #666; margin-bottom: 2rem; line-height: 1.6; }
    .actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn { padding: 0.875rem 1.5rem; border-radius: 8px; font-weight: 600; text-decoration: none; }
    .btn-primary { background: #2E7D32; color: white; }
    .btn-secondary { background: #f5f5f5; color: #333; }
  `],
})
export class CancelComponent {}
