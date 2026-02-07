import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlertsService, CampsiteAlert } from '../../../core/services/alerts.service';
import { ParksService } from '../../../core/services/parks.service';

@Component({
  selector: 'app-alerts-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <header class="page-header">
        <div class="header-content">
          <a routerLink="/dashboard" class="back-link">← Back to Dashboard</a>
          <h1>My Alerts</h1>
        </div>
        <a routerLink="/alerts/new" class="btn btn-primary">+ New Alert</a>
      </header>

      <main class="page-content">
        <!-- Filters -->
        <div class="filters">
          <button 
            class="filter-btn" 
            [class.active]="filter() === 'all'"
            (click)="setFilter('all')"
          >
            All ({{ alertsService.alerts().length }})
          </button>
          <button 
            class="filter-btn" 
            [class.active]="filter() === 'active'"
            (click)="setFilter('active')"
          >
            Active ({{ alertsService.activeAlerts().length }})
          </button>
          <button 
            class="filter-btn" 
            [class.active]="filter() === 'paused'"
            (click)="setFilter('paused')"
          >
            Paused ({{ getPausedCount() }})
          </button>
        </div>

        @if (alertsService.isLoading()) {
          <div class="loading">Loading alerts...</div>
        } @else if (filteredAlerts().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">🏕️</div>
            <h3>No alerts found</h3>
            @if (filter() === 'all') {
              <p>Create your first alert to start monitoring campsite availability.</p>
              <a routerLink="/alerts/new" class="btn btn-primary">Create Alert</a>
            } @else {
              <p>No {{ filter() }} alerts at the moment.</p>
            }
          </div>
        } @else {
          <div class="alerts-grid">
            @for (alert of filteredAlerts(); track alert.id) {
              <div class="alert-card" [class.inactive]="!alert.isActive">
                <div class="alert-header">
                  <span class="park-system">{{ parksService.getParkSystemName(alert.parkSystem) }}</span>
                  <span class="status-badge" [class.active]="alert.isActive">
                    {{ alert.isActive ? 'Active' : 'Paused' }}
                  </span>
                </div>
                
                <h3>{{ alert.name }}</h3>
                <p class="park-name">{{ alert.parkName }}</p>
                @if (alert.campgroundName) {
                  <p class="campground-name">{{ alert.campgroundName }}</p>
                }

                <div class="alert-details">
                  <div class="detail">
                    <span class="detail-label">Dates</span>
                    <span class="detail-value">{{ formatDateRange(alert.dateRangeStart, alert.dateRangeEnd) }}</span>
                  </div>
                  <div class="detail">
                    <span class="detail-label">Site Types</span>
                    <span class="detail-value">{{ formatSiteTypes(alert.siteTypes) }}</span>
                  </div>
                  <div class="detail">
                    <span class="detail-label">Nights</span>
                    <span class="detail-value">{{ alert.minNights }}-{{ alert.maxNights }}</span>
                  </div>
                </div>

                @if (alert.matchesFound > 0) {
                  <div class="matches-info">
                    <span class="matches-badge">{{ alert.matchesFound }} matches found</span>
                  </div>
                }

                @if (alert.lastChecked) {
                  <p class="last-checked">Last checked: {{ formatRelativeTime(alert.lastChecked) }}</p>
                }

                <div class="alert-actions">
                  <a [routerLink]="['/alerts', alert.id]" class="btn btn-secondary">View</a>
                  <a [routerLink]="['/alerts', alert.id, 'edit']" class="btn btn-outline">Edit</a>
                  <button 
                    class="btn btn-icon"
                    [title]="alert.isActive ? 'Pause' : 'Activate'"
                    (click)="toggleAlert(alert)"
                  >
                    {{ alert.isActive ? '⏸️' : '▶️' }}
                  </button>
                  <button 
                    class="btn btn-icon btn-danger"
                    title="Delete"
                    (click)="deleteAlert(alert)"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh;
      background: #f8f9fa;
    }

    .page-header {
      background: white;
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .back-link {
      color: #2E7D32;
      text-decoration: none;
      font-size: 0.875rem;
      display: block;
      margin-bottom: 0.5rem;
    }

    .page-header h1 {
      font-size: 1.75rem;
      color: #1a1a1a;
    }

    .page-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .filter-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }

    .filter-btn.active {
      background: #2E7D32;
      color: white;
      border-color: #2E7D32;
    }

    .loading {
      text-align: center;
      padding: 3rem;
      color: #666;
    }

    .empty-state {
      background: white;
      padding: 4rem;
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

    .alerts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .alert-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .alert-card.inactive {
      opacity: 0.7;
    }

    .alert-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .park-system {
      font-size: 0.75rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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

    .alert-card h3 {
      font-size: 1.125rem;
      color: #1a1a1a;
      margin-bottom: 0.25rem;
    }

    .park-name {
      color: #2E7D32;
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .campground-name {
      color: #666;
      font-size: 0.875rem;
    }

    .alert-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 1rem 0;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .detail-label {
      display: block;
      font-size: 0.75rem;
      color: #666;
      margin-bottom: 0.25rem;
    }

    .detail-value {
      font-size: 0.875rem;
      color: #1a1a1a;
    }

    .matches-info {
      margin: 1rem 0;
    }

    .matches-badge {
      background: #E3F2FD;
      color: #1565C0;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }

    .last-checked {
      font-size: 0.75rem;
      color: #999;
      margin-bottom: 1rem;
    }

    .alert-actions {
      display: flex;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
    }

    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #2E7D32;
      color: white;
    }

    .btn-secondary {
      background: #E8F5E9;
      color: #2E7D32;
    }

    .btn-outline {
      background: white;
      border: 1px solid #ddd;
      color: #333;
    }

    .btn-icon {
      background: none;
      padding: 0.5rem;
      font-size: 1rem;
    }

    .btn-danger:hover {
      background: #FFEBEE;
    }
  `],
})
export class AlertsListComponent implements OnInit {
  alertsService = inject(AlertsService);
  parksService = inject(ParksService);

  filter = signal<'all' | 'active' | 'paused'>('all');

  ngOnInit() {
    this.alertsService.fetchAlerts().subscribe();
  }

  setFilter(value: 'all' | 'active' | 'paused') {
    this.filter.set(value);
  }

  filteredAlerts(): CampsiteAlert[] {
    const alerts = this.alertsService.alerts();
    switch (this.filter()) {
      case 'active':
        return alerts.filter((a) => a.isActive);
      case 'paused':
        return alerts.filter((a) => !a.isActive);
      default:
        return alerts;
    }
  }

  getPausedCount(): number {
    return this.alertsService.alerts().filter((a) => !a.isActive).length;
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

  formatDateRange(start: Date | string | { _seconds: number } | null | undefined, end: Date | string | { _seconds: number } | null | undefined): string {
    const startDate = this.toDate(start);
    const endDate = this.toDate(end);
    
    if (!startDate || !endDate) {
      return 'No dates set';
    }
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return 'Invalid dates';
    }
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  }

  formatSiteTypes(types: string[] | null | undefined): string {
    if (!types || types.length === 0) {
      return 'Any';
    }
    return types.map((t) => this.parksService.getSiteTypeName(t as any)).join(', ');
  }

  formatRelativeTime(date: Date | string | { _seconds: number } | null | undefined): string {
    const d = this.toDate(date);
    
    if (!d) {
      return 'Never';
    }
    
    // Check if date is valid
    if (isNaN(d.getTime())) {
      return 'Unknown';
    }
    
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  toggleAlert(alert: CampsiteAlert) {
    this.alertsService.toggleAlert(alert.id, !alert.isActive).subscribe();
  }

  deleteAlert(alert: CampsiteAlert) {
    if (confirm(`Are you sure you want to delete "${alert.name}"?`)) {
      this.alertsService.deleteAlert(alert.id).subscribe();
    }
  }
}
