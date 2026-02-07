import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertsService, CampsiteAlert, SiteType } from '../../../core/services/alerts.service';
import { ParksService } from '../../../core/services/parks.service';

@Component({
  selector: 'app-alert-edit',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="page">
      <header class="page-header">
        <a [routerLink]="['/alerts', alertId]" class="back-link">← Back to Alert</a>
        <h1>Edit Alert</h1>
      </header>

      @if (loading()) {
        <div class="loading">Loading...</div>
      } @else if (alert()) {
        <main class="page-content">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="edit-form">
            @if (error()) {
              <div class="error-message">{{ error() }}</div>
            }

            <div class="form-section">
              <h2>Alert Name</h2>
              <div class="form-group">
                <input type="text" formControlName="name" />
              </div>
            </div>

            <div class="form-section">
              <h2>Campsites</h2>
              <div class="campsite-info">
                <div class="campsite-detail">
                  <span class="campsite-label">Park</span>
                  <span class="campsite-value">{{ alert()!.parkName }}</span>
                </div>
                @if (alert()!.campgroundName) {
                  <div class="campsite-detail">
                    <span class="campsite-label">Campground</span>
                    <span class="campsite-value">{{ alert()!.campgroundName }}</span>
                  </div>
                }
                @if (alert()!.specificSiteIds && alert()!.specificSiteIds!.length > 0) {
                  <div class="campsite-detail">
                    <span class="campsite-label">Specific Sites</span>
                    <span class="campsite-value">{{ alert()!.specificSiteIds!.length }} site(s) selected</span>
                  </div>
                }
                <p class="campsite-note">To change the park or campground, create a new alert.</p>
              </div>
            </div>

            <div class="form-section">
              <h2>Date Range</h2>
              <div class="date-inputs">
                <div class="form-group">
                  <label>Start Date</label>
                  <input type="date" formControlName="dateRangeStart" [min]="minDate" />
                </div>
                <div class="form-group">
                  <label>End Date</label>
                  <input type="date" formControlName="dateRangeEnd" [min]="form.get('dateRangeStart')?.value" />
                </div>
              </div>
              <label class="checkbox">
                <input type="checkbox" formControlName="flexibleDates" />
                <span>Flexible dates</span>
              </label>
            </div>

            <div class="form-section">
              <h2>Site Types</h2>
              <div class="site-types">
                @for (type of siteTypes; track type.id) {
                  <label class="checkbox-card" [class.checked]="isSiteTypeSelected(type.id)">
                    <input type="checkbox" [checked]="isSiteTypeSelected(type.id)" (change)="toggleSiteType(type.id)" />
                    <span class="checkbox-icon">{{ type.icon }}</span>
                    <span class="checkbox-label">{{ type.name }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="form-section">
              <h2>Stay Length</h2>
              <div class="nights-inputs">
                <div class="form-group">
                  <label>Min Nights</label>
                  <input type="number" formControlName="minNights" min="1" max="14" />
                </div>
                <div class="form-group">
                  <label>Max Nights</label>
                  <input type="number" formControlName="maxNights" min="1" max="14" />
                </div>
              </div>
            </div>

            <div class="form-actions">
              <a [routerLink]="['/alerts', alertId]" class="btn btn-secondary">Cancel</a>
              <button type="submit" class="btn btn-primary" [disabled]="saving()">
                {{ saving() ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </main>
      }
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; background: #f8f9fa; }
    .page-header { background: white; padding: 1.5rem 2rem; border-bottom: 1px solid #e0e0e0; }
    .back-link { color: #2E7D32; text-decoration: none; font-size: 0.875rem; display: block; margin-bottom: 0.5rem; }
    .page-header h1 { font-size: 1.75rem; color: #1a1a1a; }
    .page-content { max-width: 600px; margin: 0 auto; padding: 2rem; }
    .loading { text-align: center; padding: 3rem; color: #666; }
    .edit-form { background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .error-message { background: #FFEBEE; color: #C62828; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
    .form-section { margin-bottom: 2rem; }
    .form-section h2 { font-size: 1rem; color: #1a1a1a; margin-bottom: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.875rem; color: #666; margin-bottom: 0.25rem; }
    .form-group input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box; }
    .form-group input:focus { outline: none; border-color: #2E7D32; }
    .date-inputs, .nights-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    .checkbox { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .site-types { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
    .checkbox-card { display: flex; flex-direction: column; align-items: center; padding: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; text-align: center; }
    .checkbox-card.checked { border-color: #2E7D32; background: #E8F5E9; }
    .checkbox-card input { display: none; }
    .checkbox-icon { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .checkbox-label { font-size: 0.75rem; }
    .form-actions { display: flex; justify-content: flex-end; gap: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0; }
    .btn { padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; }
    .btn-primary { background: #2E7D32; color: white; }
    .btn-primary:disabled { background: #A5D6A7; }
    .btn-secondary { background: #f5f5f5; color: #333; }
    .campsite-info { background: #f8f9fa; border-radius: 8px; padding: 1rem; }
    .campsite-detail { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #e0e0e0; }
    .campsite-detail:last-of-type { border-bottom: none; }
    .campsite-label { font-size: 0.875rem; color: #666; }
    .campsite-value { font-weight: 500; color: #1a1a1a; }
    .campsite-note { font-size: 0.75rem; color: #999; margin-top: 0.75rem; margin-bottom: 0; font-style: italic; }
  `],
})
export class AlertEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private alertsService = inject(AlertsService);
  private parksService = inject(ParksService);

  alertId = '';
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  alert = signal<CampsiteAlert | null>(null);
  selectedSiteTypes = signal<SiteType[]>([]);
  minDate = new Date().toISOString().split('T')[0];

  siteTypes = [
    { id: 'tent', name: 'Tent', icon: '⛺' },
    { id: 'rv', name: 'RV', icon: '🚐' },
    { id: 'cabin', name: 'Cabin', icon: '🏠' },
    { id: 'group', name: 'Group', icon: '👥' },
  ];

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    dateRangeStart: ['', Validators.required],
    dateRangeEnd: ['', Validators.required],
    flexibleDates: [false],
    minNights: [1, [Validators.required, Validators.min(1)]],
    maxNights: [7, [Validators.required, Validators.min(1)]],
  });

  ngOnInit() {
    this.alertId = this.route.snapshot.paramMap.get('id') || '';
    if (this.alertId) {
      this.alertsService.getAlert(this.alertId).subscribe({
        next: (alert) => {
          this.alert.set(alert);
          this.selectedSiteTypes.set(alert.siteTypes);
          this.form.patchValue({
            name: alert.name,
            dateRangeStart: this.formatDateForInput(alert.dateRangeStart),
            dateRangeEnd: this.formatDateForInput(alert.dateRangeEnd),
            flexibleDates: alert.flexibleDates,
            minNights: alert.minNights,
            maxNights: alert.maxNights,
          });
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
    }
  }

  formatDateForInput(date: Date | string | { _seconds: number; _nanoseconds?: number } | null | undefined): string {
    if (!date) {
      return '';
    }
    
    let d: Date;
    
    // Handle Firestore Timestamp objects
    if (typeof date === 'object' && '_seconds' in date) {
      d = new Date(date._seconds * 1000);
    } else if (date instanceof Date) {
      d = date;
    } else {
      d = new Date(date);
    }
    
    // Check if date is valid
    if (isNaN(d.getTime())) {
      return '';
    }
    
    return d.toISOString().split('T')[0];
  }

  isSiteTypeSelected(type: string): boolean {
    return this.selectedSiteTypes().includes(type as SiteType);
  }

  toggleSiteType(type: string) {
    this.selectedSiteTypes.update((types) => {
      if (types.includes(type as SiteType)) {
        return types.filter((t) => t !== type);
      }
      return [...types, type as SiteType];
    });
  }

  onSubmit() {
    if (this.form.invalid || this.selectedSiteTypes().length === 0) return;

    this.saving.set(true);
    this.error.set(null);

    const updates = {
      name: this.form.get('name')?.value,
      dateRangeStart: new Date(this.form.get('dateRangeStart')?.value),
      dateRangeEnd: new Date(this.form.get('dateRangeEnd')?.value),
      flexibleDates: this.form.get('flexibleDates')?.value,
      minNights: this.form.get('minNights')?.value,
      maxNights: this.form.get('maxNights')?.value,
      siteTypes: this.selectedSiteTypes(),
    };

    this.alertsService.updateAlert(this.alertId, updates).subscribe({
      next: () => {
        this.router.navigate(['/alerts', this.alertId]);
      },
      error: (err) => {
        this.error.set(err.message);
        this.saving.set(false);
      },
    });
  }
}
