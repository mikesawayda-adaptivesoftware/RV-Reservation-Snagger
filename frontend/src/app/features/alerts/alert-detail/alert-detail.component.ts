import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AlertsService, CampsiteAlert, AlertMatch } from '../../../core/services/alerts.service';
import { ParksService } from '../../../core/services/parks.service';

@Component({
  selector: 'app-alert-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <header class="page-header">
        <a routerLink="/alerts" class="back-link">← Back to Alerts</a>
        @if (alert()) {
          <h1>{{ alert()!.name }}</h1>
        }
      </header>

      @if (loading()) {
        <div class="loading">Loading alert details...</div>
      } @else if (error()) {
        <div class="error-message">{{ error() }}</div>
      } @else if (alert()) {
        <main class="page-content">
          <!-- Alert Info Card -->
          <div class="info-card">
            <div class="info-header">
              <span class="park-system">{{ parksService.getParkSystemName(alert()!.parkSystem) }}</span>
              <span class="status-badge" [class.active]="alert()!.isActive">
                {{ alert()!.isActive ? 'Active' : 'Paused' }}
              </span>
            </div>

            <h2 class="park-name">{{ alert()!.parkName }}</h2>
            @if (alert()!.campgroundName) {
              <p class="campground-name">{{ alert()!.campgroundName }}</p>
            }

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Date Range</span>
                <span class="info-value">{{ formatDate(alert()!.dateRangeStart) }} - {{ formatDate(alert()!.dateRangeEnd) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Site Types</span>
                <span class="info-value">{{ formatSiteTypes(alert()!.siteTypes) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Stay Length</span>
                <span class="info-value">{{ alert()!.minNights }} - {{ alert()!.maxNights }} nights</span>
              </div>
              <div class="info-item">
                <span class="info-label">Flexible Dates</span>
                <span class="info-value">{{ alert()!.flexibleDates ? 'Yes' : 'No' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Last Checked</span>
                <span class="info-value">{{ alert()!.lastChecked ? formatRelativeTime(alert()!.lastChecked!) : 'Never' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Matches</span>
                <span class="info-value">{{ alert()!.matchesFound }}</span>
              </div>
            </div>

            <div class="info-actions">
              <button 
                class="btn btn-primary" 
                (click)="checkNow()"
                [disabled]="checking() || !alert()!.isActive"
              >
                {{ checking() ? 'Checking...' : 'Check Now' }}
              </button>
              <button 
                class="btn" 
                [class.btn-secondary]="alert()!.isActive"
                [class.btn-outline]="!alert()!.isActive"
                (click)="toggleAlert()"
              >
                {{ alert()!.isActive ? 'Pause Alert' : 'Activate Alert' }}
              </button>
              <a [routerLink]="['/alerts', alert()!.id, 'edit']" class="btn btn-outline">Edit Alert</a>
              <button class="btn btn-danger" (click)="deleteAlert()">Delete</button>
            </div>
            @if (checkResult()) {
              <div class="check-result" [class.has-matches]="checkResult()!.matchesFound > 0">
                {{ checkResult()!.matchesFound > 0 
                   ? 'Found ' + checkResult()!.matchesFound + ' available site(s)!' 
                   : 'No availability found at this time.' }}
              </div>
            }
          </div>

          <!-- Matches Section -->
          <section class="matches-section">
            <h2>Matches Found ({{ matches().length }})</h2>

            @if (matchesLoading()) {
              <div class="loading">Loading matches...</div>
            } @else if (matches().length === 0) {
              <div class="empty-state">
                <p>No matches found yet. We'll notify you when a site becomes available!</p>
              </div>
            } @else {
              <div class="matches-list">
                @for (match of matches(); track match.id) {
                  <div class="match-card" [class.expired]="match.isExpired">
                    <div class="match-info">
                      <h3>{{ match.siteName }}</h3>
                      <p class="match-meta">{{ match.campgroundName }} • {{ parksService.getSiteTypeName(match.siteType) }}</p>
                      <div class="match-dates">
                        <span class="date-label">Available:</span>
                        @for (range of match.availableDates; track $index) {
                          <span class="date-range">
                            {{ formatDate(range.start) }} - {{ formatDate(range.end) }}
                          </span>
                        }
                      </div>
                      <p class="match-found">Found {{ formatRelativeTime(match.foundAt) }}</p>
                    </div>
                    <div class="match-actions">
                      @if (!match.isExpired) {
                        <a [href]="match.reservationUrl" target="_blank" class="btn btn-primary">
                          Book Now →
                        </a>
                      } @else {
                        <span class="expired-badge">Expired</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </section>
        </main>
      }
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
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    .loading {
      text-align: center;
      padding: 3rem;
      color: #666;
    }

    .error-message {
      background: #FFEBEE;
      color: #C62828;
      padding: 1rem;
      margin: 2rem;
      border-radius: 8px;
      text-align: center;
    }

    .info-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }

    .info-header {
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
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      background: #f5f5f5;
      color: #666;
    }

    .status-badge.active {
      background: #E8F5E9;
      color: #2E7D32;
    }

    .park-name {
      font-size: 1.5rem;
      color: #2E7D32;
      margin-bottom: 0.25rem;
    }

    .campground-name {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1.5rem;
      padding: 1.5rem;
      background: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .info-label {
      display: block;
      font-size: 0.75rem;
      color: #666;
      margin-bottom: 0.25rem;
    }

    .info-value {
      font-weight: 500;
      color: #1a1a1a;
    }

    .info-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .btn {
      padding: 0.625rem 1.25rem;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      text-decoration: none;
      font-size: 0.875rem;
    }

    .btn-primary {
      background: #2E7D32;
      color: white;
    }

    .btn-secondary {
      background: #f5f5f5;
      color: #333;
    }

    .btn-outline {
      background: white;
      border: 1px solid #ddd;
      color: #333;
    }

    .btn-danger {
      background: white;
      border: 1px solid #FFCDD2;
      color: #C62828;
    }

    .btn-danger:hover {
      background: #FFEBEE;
    }

    .matches-section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #1a1a1a;
    }

    .empty-state {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      color: #666;
    }

    .matches-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .match-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .match-card.expired {
      opacity: 0.6;
    }

    .match-info h3 {
      font-size: 1.125rem;
      color: #1a1a1a;
      margin-bottom: 0.25rem;
    }

    .match-meta {
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .match-dates {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .date-label {
      font-size: 0.75rem;
      color: #666;
    }

    .date-range {
      background: #E3F2FD;
      color: #1565C0;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .match-found {
      font-size: 0.75rem;
      color: #999;
    }

    .expired-badge {
      color: #999;
      font-size: 0.875rem;
    }

    .check-result {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      background: #f5f5f5;
      color: #666;
    }

    .check-result.has-matches {
      background: #E8F5E9;
      color: #2E7D32;
      font-weight: 500;
    }
  `],
})
export class AlertDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private alertsService = inject(AlertsService);
  parksService = inject(ParksService);

  loading = signal(true);
  matchesLoading = signal(true);
  checking = signal(false);
  error = signal<string | null>(null);
  alert = signal<CampsiteAlert | null>(null);
  matches = signal<AlertMatch[]>([]);
  checkResult = signal<{ matchesFound: number } | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAlert(id);
      this.loadMatches(id);
    }
  }

  loadAlert(id: string) {
    this.alertsService.getAlert(id).subscribe({
      next: (alert) => {
        this.alert.set(alert);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load alert');
        this.loading.set(false);
      },
    });
  }

  loadMatches(id: string) {
    this.alertsService.getAlertMatches(id).subscribe({
      next: (response) => {
        this.matches.set(response.items);
        this.matchesLoading.set(false);
      },
      error: () => {
        this.matchesLoading.set(false);
      },
    });
  }

  toggleAlert() {
    const current = this.alert();
    if (!current) return;

    this.alertsService.toggleAlert(current.id, !current.isActive).subscribe({
      next: (updated) => {
        this.alert.set(updated);
      },
    });
  }

  deleteAlert() {
    const current = this.alert();
    if (!current) return;

    if (confirm(`Are you sure you want to delete "${current.name}"?`)) {
      this.alertsService.deleteAlert(current.id).subscribe({
        next: () => {
          window.location.href = '/alerts';
        },
      });
    }
  }

  checkNow() {
    const current = this.alert();
    if (!current || !current.isActive) return;

    this.checking.set(true);
    this.checkResult.set(null);

    this.alertsService.checkAlertNow(current.id).subscribe({
      next: (result) => {
        this.checkResult.set(result);
        this.checking.set(false);
        // Reload the alert and matches to get updated data
        this.loadAlert(current.id);
        this.loadMatches(current.id);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to check for availability');
        this.checking.set(false);
      },
    });
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
      return 'Invalid date';
    }
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    
    if (isNaN(d.getTime())) {
      return 'Unknown';
    }
    
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
