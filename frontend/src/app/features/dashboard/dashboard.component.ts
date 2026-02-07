import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertsService, CampsiteAlert } from '../../core/services/alerts.service';
import { SubscriptionService } from '../../core/services/subscription.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="header-content">
          <h1>Dashboard</h1>
          <div class="header-actions">
            <a routerLink="/alerts/new" class="btn btn-primary">+ New Alert</a>
            <div class="user-menu">
              <button class="user-button" (click)="toggleUserMenu()">
                {{ authService.userProfile()?.displayName || authService.currentUser()?.email }}
              </button>
              @if (showUserMenu()) {
                <div class="user-dropdown">
                  <a routerLink="/profile">Profile</a>
                  <a routerLink="/subscription/pricing">Subscription</a>
                  <button (click)="signOut()">Sign Out</button>
                </div>
              }
            </div>
          </div>
        </div>
      </header>

      <main class="dashboard-content">
        <!-- Stats Cards -->
        <section class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ alertsService.activeAlerts().length }}</div>
            <div class="stat-label">Active Alerts</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ getTotalMatches() }}</div>
            <div class="stat-label">Matches Found</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ subscriptionService.currentTier() | titlecase }}</div>
            <div class="stat-label">Current Plan</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ subscriptionService.getScrapeIntervalText(subscriptionService.currentTier()) }}</div>
            <div class="stat-label">Check Frequency</div>
          </div>
        </section>

        <!-- Alerts Section -->
        <section class="alerts-section">
          <div class="section-header">
            <h2>Your Alerts</h2>
            <a routerLink="/alerts" class="view-all">View All</a>
          </div>

          @if (alertsService.isLoading()) {
            <div class="loading">Loading alerts...</div>
          } @else if (alertsService.alerts().length === 0) {
            <div class="empty-state">
              <div class="empty-icon">🏕️</div>
              <h3>No alerts yet</h3>
              <p>Create your first alert to start monitoring campsite availability.</p>
              <a routerLink="/alerts/new" class="btn btn-primary">Create Alert</a>
            </div>
          } @else {
            <div class="alerts-list">
              @for (alert of alertsService.alerts().slice(0, 5); track alert.id) {
                <div class="alert-card" [class.inactive]="!alert.isActive">
                  <div class="alert-info">
                    <h3>{{ alert.name }}</h3>
                    <p class="alert-meta">
                      {{ alert.parkName }}
                      @if (alert.campgroundName) {
                        &bull; {{ alert.campgroundName }}
                      }
                    </p>
                    <p class="alert-dates">
                      {{ formatDate(alert.dateRangeStart) }} - {{ formatDate(alert.dateRangeEnd) }}
                    </p>
                  </div>
                  <div class="alert-status">
                    <span class="status-badge" [class.active]="alert.isActive">
                      {{ alert.isActive ? 'Active' : 'Paused' }}
                    </span>
                    @if (alert.matchesFound > 0) {
                      <span class="matches-badge">{{ alert.matchesFound }} matches</span>
                    }
                  </div>
                  <div class="alert-actions">
                    <a [routerLink]="['/alerts', alert.id]" class="btn-icon" title="View">👁️</a>
                    <button 
                      class="btn-icon" 
                      [title]="alert.isActive ? 'Pause' : 'Activate'"
                      (click)="toggleAlert(alert)"
                    >
                      {{ alert.isActive ? '⏸️' : '▶️' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Quick Actions -->
        <section class="quick-actions">
          <h2>Quick Actions</h2>
          <div class="actions-grid">
            <a routerLink="/alerts/new" class="action-card">
              <span class="action-icon">➕</span>
              <span class="action-label">New Alert</span>
            </a>
            <a routerLink="/subscription/pricing" class="action-card">
              <span class="action-icon">⬆️</span>
              <span class="action-label">Upgrade Plan</span>
            </a>
            <a routerLink="/profile" class="action-card">
              <span class="action-icon">⚙️</span>
              <span class="action-label">Settings</span>
            </a>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    .dashboard {
      min-height: 100vh;
      background: #f8f9fa;
    }

    .dashboard-header {
      background: white;
      border-bottom: 1px solid #e0e0e0;
      padding: 1rem 2rem;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-content h1 {
      font-size: 1.5rem;
      color: #1a1a1a;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-menu {
      position: relative;
    }

    .user-button {
      background: none;
      border: 1px solid #ddd;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .user-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      min-width: 150px;
      margin-top: 0.5rem;
      z-index: 100;
    }

    .user-dropdown a,
    .user-dropdown button {
      display: block;
      width: 100%;
      padding: 0.75rem 1rem;
      text-align: left;
      border: none;
      background: none;
      cursor: pointer;
      color: #333;
      text-decoration: none;
    }

    .user-dropdown a:hover,
    .user-dropdown button:hover {
      background: #f5f5f5;
    }

    .dashboard-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #2E7D32;
    }

    .stat-label {
      color: #666;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .section-header h2 {
      font-size: 1.25rem;
      color: #1a1a1a;
    }

    .view-all {
      color: #2E7D32;
      text-decoration: none;
      font-size: 0.875rem;
    }

    .view-all:hover {
      text-decoration: underline;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #666;
    }

    .empty-state {
      background: white;
      padding: 3rem;
      border-radius: 12px;
      text-align: center;
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      margin-bottom: 0.5rem;
      color: #1a1a1a;
    }

    .empty-state p {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .alert-card {
      background: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .alert-card.inactive {
      opacity: 0.7;
    }

    .alert-info {
      flex: 1;
    }

    .alert-info h3 {
      font-size: 1rem;
      margin-bottom: 0.25rem;
      color: #1a1a1a;
    }

    .alert-meta {
      font-size: 0.875rem;
      color: #666;
    }

    .alert-dates {
      font-size: 0.75rem;
      color: #999;
      margin-top: 0.25rem;
    }

    .alert-status {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }

    .status-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      background: #f5f5f5;
      color: #666;
    }

    .status-badge.active {
      background: #E8F5E9;
      color: #2E7D32;
    }

    .matches-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      background: #E3F2FD;
      color: #1565C0;
    }

    .alert-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.25rem;
      padding: 0.25rem;
      text-decoration: none;
    }

    .quick-actions {
      margin-top: 2rem;
    }

    .quick-actions h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #1a1a1a;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .action-card {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      text-align: center;
      text-decoration: none;
      color: #333;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }

    .action-card:hover {
      transform: translateY(-2px);
    }

    .action-icon {
      font-size: 2rem;
      display: block;
      margin-bottom: 0.5rem;
    }

    .action-label {
      font-size: 0.875rem;
    }

    .btn {
      display: inline-block;
      padding: 0.625rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
    }

    .btn-primary {
      background: #2E7D32;
      color: white;
    }

    .btn-primary:hover {
      background: #1B5E20;
    }
  `],
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  alertsService = inject(AlertsService);
  subscriptionService = inject(SubscriptionService);

  showUserMenu = signal(false);

  ngOnInit() {
    this.alertsService.fetchAlerts().subscribe();
    this.subscriptionService.fetchCurrentSubscription().subscribe();
    this.subscriptionService.fetchPricingTiers().subscribe();
  }

  toggleUserMenu() {
    this.showUserMenu.update((v) => !v);
  }

  getTotalMatches(): number {
    return this.alertsService.alerts().reduce((sum, a) => sum + (a.matchesFound || 0), 0);
  }

  private toDate(date: Date | string | { _seconds: number; _nanoseconds?: number } | null | undefined): Date | null {
    if (!date) {
      return null;
    }
    
    // Handle Firestore Timestamp objects
    if (typeof date === 'object' && '_seconds' in date) {
      return new Date(date._seconds * 1000);
    }
    
    if (date instanceof Date) {
      return date;
    }
    
    return new Date(date);
  }

  formatDate(date: Date | string | { _seconds: number } | null | undefined): string {
    const d = this.toDate(date);
    
    if (!d) {
      return 'Not set';
    }
    
    if (isNaN(d.getTime())) {
      return 'Invalid';
    }
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  toggleAlert(alert: CampsiteAlert) {
    this.alertsService.toggleAlert(alert.id, !alert.isActive).subscribe();
  }

  signOut() {
    this.authService.signOut();
  }
}
