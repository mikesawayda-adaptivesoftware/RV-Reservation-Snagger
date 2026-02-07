import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertsService, CreateAlertDto, ParkSystem, SiteType } from '../../../core/services/alerts.service';
import { ParksService, ParkSearchResult, CampgroundSearchResult } from '../../../core/services/parks.service';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-alert-create',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="page">
      <header class="page-header">
        <a routerLink="/alerts" class="back-link">← Back to Alerts</a>
        <h1>Create New Alert</h1>
      </header>

      <main class="page-content">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="alert-form">
          @if (error()) {
            <div class="error-message">{{ error() }}</div>
          }

          <!-- Step 1: Park System -->
          <section class="form-section">
            <h2>1. Select Park System</h2>
            <div class="park-systems">
              @for (system of parkSystems; track system.id) {
                <label 
                  class="park-system-option"
                  [class.selected]="form.get('parkSystem')?.value === system.id"
                >
                  <input 
                    type="radio" 
                    formControlName="parkSystem" 
                    [value]="system.id"
                    (change)="onParkSystemChange()"
                  />
                  <span class="option-content">
                    <span class="option-name">{{ system.name }}</span>
                    <span class="option-desc">{{ system.description }}</span>
                  </span>
                </label>
              }
            </div>
          </section>

          <!-- Step 2: Park Selection -->
          @if (form.get('parkSystem')?.value) {
            <section class="form-section">
              <h2>2. Select Park</h2>
              <div class="form-group">
                <label for="parkSearch">Search Parks</label>
                <input 
                  type="text" 
                  id="parkSearch"
                  formControlName="parkSearch"
                  placeholder="Type to search parks..."
                  autocomplete="off"
                />
              </div>

              @if (searchLoading()) {
                <div class="search-loading">Searching...</div>
              }

              @if (parkResults().length > 0 && !selectedPark()) {
                <div class="search-results">
                  @for (park of parkResults(); track park.id) {
                    <button 
                      type="button" 
                      class="search-result"
                      (click)="selectPark(park)"
                    >
                      <span class="result-name">{{ park.name }}</span>
                      <span class="result-meta">{{ park.state }}{{ park.campgroundCount ? ' • ' + park.campgroundCount + ' campgrounds' : '' }}</span>
                    </button>
                  }
                </div>
              }

              @if (selectedPark()) {
                <div class="selected-item">
                  <div class="selected-info">
                    <strong>{{ selectedPark()!.name }}</strong>
                    <span>{{ selectedPark()!.state }}</span>
                  </div>
                  <button type="button" class="btn-clear" (click)="clearPark()">Change</button>
                </div>
              }
            </section>
          }

          <!-- Step 3: Campground Selection (Optional) -->
          @if (selectedPark()) {
            <section class="form-section">
              <h2>3. Select Campground (Optional)</h2>
              <p class="form-hint">Leave unselected to monitor all campgrounds in this park.</p>
              
              @if (campgroundsLoading()) {
                <div class="loading-campgrounds">Loading campgrounds...</div>
              } @else if (campgrounds().length === 0) {
                <p class="no-campgrounds">No specific campgrounds found. The alert will monitor the entire recreation area.</p>
              } @else {
                <div class="campground-grid">
                  @for (cg of campgrounds(); track cg.id) {
                    <label 
                      class="campground-option"
                      [class.selected]="selectedCampground()?.id === cg.id"
                    >
                      <input 
                        type="radio" 
                        name="campground" 
                        [value]="cg.id"
                        [checked]="selectedCampground()?.id === cg.id"
                        (change)="selectCampground(cg)"
                      />
                      <span class="option-content">
                        <span class="option-name">{{ cg.name }}</span>
                        <span class="option-desc">{{ cg.totalSites ? cg.totalSites + ' sites' : '' }}</span>
                      </span>
                    </label>
                  }
                </div>
              }
              
              @if (selectedCampground()) {
                <button type="button" class="btn-text" (click)="clearCampground()">
                  Clear selection (monitor all campgrounds)
                </button>
              }
            </section>
          }

          <!-- Step 4: Date Range -->
          @if (selectedPark()) {
            <section class="form-section">
              <h2>{{ campgrounds().length > 0 ? '4' : '3' }}. Select Dates</h2>
              <div class="date-inputs">
                <div class="form-group">
                  <label for="dateStart">Start Date</label>
                  <input 
                    type="date" 
                    id="dateStart"
                    formControlName="dateRangeStart"
                    [min]="minDate"
                  />
                </div>
                <div class="form-group">
                  <label for="dateEnd">End Date</label>
                  <input 
                    type="date" 
                    id="dateEnd"
                    formControlName="dateRangeEnd"
                    [min]="form.get('dateRangeStart')?.value || minDate"
                  />
                </div>
              </div>

              <div class="checkbox-group">
                <label class="checkbox">
                  <input type="checkbox" formControlName="flexibleDates" />
                  <span>I'm flexible on dates (notify me of nearby availability)</span>
                </label>
              </div>
            </section>
          }

          <!-- Step 5: Site Preferences -->
          @if (selectedPark()) {
            <section class="form-section">
              <h2>{{ campgrounds().length > 0 ? '5' : '4' }}. Site Preferences</h2>
              
              <div class="form-group">
                <label>Site Types</label>
                <div class="site-types">
                  @for (type of siteTypes; track type.id) {
                    <label class="checkbox-card" [class.checked]="isSiteTypeSelected(type.id)">
                      <input 
                        type="checkbox" 
                        [checked]="isSiteTypeSelected(type.id)"
                        (change)="toggleSiteType(type.id)"
                      />
                      <span class="checkbox-icon">{{ type.icon }}</span>
                      <span class="checkbox-label">{{ type.name }}</span>
                    </label>
                  }
                </div>
              </div>

              <div class="nights-inputs">
                <div class="form-group">
                  <label for="minNights">Minimum Nights</label>
                  <input 
                    type="number" 
                    id="minNights"
                    formControlName="minNights"
                    min="1"
                    max="14"
                  />
                </div>
                <div class="form-group">
                  <label for="maxNights">Maximum Nights</label>
                  <input 
                    type="number" 
                    id="maxNights"
                    formControlName="maxNights"
                    min="1"
                    max="14"
                  />
                </div>
              </div>
            </section>
          }

          <!-- Step 6: Alert Name -->
          @if (selectedPark()) {
            <section class="form-section">
              <h2>{{ campgrounds().length > 0 ? '6' : '5' }}. Name Your Alert</h2>
              <div class="form-group">
                <label for="name">Alert Name</label>
                <input 
                  type="text" 
                  id="name"
                  formControlName="name"
                  [placeholder]="getDefaultName()"
                />
                <span class="form-hint">Leave blank to use the default name</span>
              </div>
            </section>
          }

          <!-- Submit -->
          @if (selectedPark()) {
            <div class="form-actions">
              <a routerLink="/alerts" class="btn btn-secondary">Cancel</a>
              <button 
                type="submit" 
                class="btn btn-primary"
                [disabled]="loading() || !isFormValid()"
              >
                @if (loading()) {
                  Creating...
                } @else {
                  Create Alert
                }
              </button>
            </div>
          }
        </form>
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
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    .alert-form {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .error-message {
      background: #FFEBEE;
      color: #C62828;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .form-section {
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .form-section:last-of-type {
      border-bottom: none;
    }

    .form-section h2 {
      font-size: 1.125rem;
      color: #1a1a1a;
      margin-bottom: 1rem;
    }

    .park-systems {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .park-system-option {
      display: flex;
      align-items: center;
      padding: 1rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .park-system-option:hover {
      border-color: #A5D6A7;
    }

    .park-system-option.selected {
      border-color: #2E7D32;
      background: #E8F5E9;
    }

    .park-system-option input {
      margin-right: 1rem;
    }

    .option-content {
      display: flex;
      flex-direction: column;
    }

    .option-name {
      font-weight: 500;
      color: #1a1a1a;
    }

    .option-desc {
      font-size: 0.875rem;
      color: #666;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #333;
    }

    .form-group input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      box-sizing: border-box;
    }

    .form-group input:focus {
      outline: none;
      border-color: #2E7D32;
    }

    .form-hint {
      font-size: 0.75rem;
      color: #666;
      margin-top: 0.25rem;
    }

    .search-loading {
      padding: 1rem;
      color: #666;
      text-align: center;
    }

    .search-results {
      border: 1px solid #ddd;
      border-radius: 8px;
      max-height: 300px;
      overflow-y: auto;
    }

    .search-result {
      display: block;
      width: 100%;
      padding: 1rem;
      text-align: left;
      border: none;
      background: white;
      cursor: pointer;
      border-bottom: 1px solid #e0e0e0;
    }

    .search-result:last-child {
      border-bottom: none;
    }

    .search-result:hover {
      background: #f5f5f5;
    }

    .result-name {
      display: block;
      font-weight: 500;
      color: #1a1a1a;
    }

    .result-meta {
      font-size: 0.875rem;
      color: #666;
    }

    .selected-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #E8F5E9;
      border-radius: 8px;
    }

    .btn-clear {
      background: none;
      border: none;
      color: #2E7D32;
      cursor: pointer;
      text-decoration: underline;
    }

    .campground-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
    }

    .campground-option {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
    }

    .campground-option.selected {
      border-color: #2E7D32;
      background: #E8F5E9;
    }

    .campground-option input {
      margin-right: 0.75rem;
    }

    .btn-text {
      background: none;
      border: none;
      color: #2E7D32;
      cursor: pointer;
      padding: 0.5rem 0;
      margin-top: 0.5rem;
    }

    .date-inputs, .nights-inputs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .checkbox-group {
      margin-top: 1rem;
    }

    .checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .site-types {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.75rem;
    }

    .checkbox-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      text-align: center;
    }

    .checkbox-card.checked {
      border-color: #2E7D32;
      background: #E8F5E9;
    }

    .checkbox-card input {
      display: none;
    }

    .checkbox-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .checkbox-label {
      font-size: 0.875rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 2rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      text-decoration: none;
    }

    .btn-primary {
      background: #2E7D32;
      color: white;
    }

    .btn-primary:disabled {
      background: #A5D6A7;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f5f5f5;
      color: #333;
    }

    .loading-campgrounds {
      padding: 1rem;
      text-align: center;
      color: #666;
      font-style: italic;
    }

    .no-campgrounds {
      padding: 1rem;
      color: #666;
      background: #f5f5f5;
      border-radius: 8px;
      text-align: center;
    }
  `],
})
export class AlertCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private alertsService = inject(AlertsService);
  private parksService = inject(ParksService);

  loading = signal(false);
  error = signal<string | null>(null);
  searchLoading = signal(false);
  campgroundsLoading = signal(false);
  parkResults = signal<ParkSearchResult[]>([]);
  selectedPark = signal<ParkSearchResult | null>(null);
  campgrounds = signal<CampgroundSearchResult[]>([]);
  selectedCampground = signal<CampgroundSearchResult | null>(null);
  selectedSiteTypes = signal<SiteType[]>(['tent', 'rv']);

  minDate = new Date().toISOString().split('T')[0];

  parkSystems = [
    { id: 'recreation_gov', name: 'Recreation.gov', description: 'National Parks, National Forests, BLM' },
    { id: 'reserve_america', name: 'ReserveAmerica', description: 'State Parks across multiple states' },
    { id: 'reserve_california', name: 'ReserveCalifornia', description: 'California State Parks' },
  ];

  siteTypes = [
    { id: 'tent', name: 'Tent', icon: '⛺' },
    { id: 'rv', name: 'RV/Trailer', icon: '🚐' },
    { id: 'cabin', name: 'Cabin', icon: '🏠' },
    { id: 'group', name: 'Group', icon: '👥' },
  ];

  form: FormGroup = this.fb.group({
    parkSystem: ['', Validators.required],
    parkSearch: [''],
    dateRangeStart: ['', Validators.required],
    dateRangeEnd: ['', Validators.required],
    flexibleDates: [false],
    minNights: [1, [Validators.required, Validators.min(1), Validators.max(14)]],
    maxNights: [7, [Validators.required, Validators.min(1), Validators.max(14)]],
    name: [''],
  });

  ngOnInit() {
    // Set up park search debouncing
    this.form.get('parkSearch')?.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        if (!query || query.length < 2 || this.selectedPark()) {
          this.parkResults.set([]);
          return of([]);
        }
        this.searchLoading.set(true);
        const system = this.form.get('parkSystem')?.value;
        return this.parksService.searchParks(query, system);
      })
    ).subscribe((results) => {
      this.parkResults.set(results);
      this.searchLoading.set(false);
    });
  }

  onParkSystemChange() {
    this.clearPark();
    this.form.get('parkSearch')?.setValue('');
  }

  selectPark(park: ParkSearchResult) {
    this.selectedPark.set(park);
    this.parkResults.set([]);
    this.form.get('parkSearch')?.setValue(park.name);
    
    // Load campgrounds
    this.campgroundsLoading.set(true);
    this.campgrounds.set([]);
    this.parksService.getCampgrounds(park.parkSystem, park.id).subscribe({
      next: (cgs) => {
        this.campgrounds.set(cgs);
        this.campgroundsLoading.set(false);
      },
      error: () => {
        this.campgroundsLoading.set(false);
      }
    });
  }

  clearPark() {
    this.selectedPark.set(null);
    this.campgrounds.set([]);
    this.selectedCampground.set(null);
    this.form.get('parkSearch')?.setValue('');
  }

  selectCampground(campground: CampgroundSearchResult) {
    this.selectedCampground.set(campground);
  }

  clearCampground() {
    this.selectedCampground.set(null);
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

  getDefaultName(): string {
    const park = this.selectedPark();
    if (!park) return 'My Alert';
    
    const campground = this.selectedCampground();
    if (campground) {
      return `${campground.name} Alert`;
    }
    return `${park.name} Alert`;
  }

  isFormValid(): boolean {
    const park = this.selectedPark();
    const startDate = this.form.get('dateRangeStart')?.value;
    const endDate = this.form.get('dateRangeEnd')?.value;
    const siteTypes = this.selectedSiteTypes();
    
    return !!(park && startDate && endDate && siteTypes.length > 0);
  }

  onSubmit() {
    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.error.set(null);

    const park = this.selectedPark()!;
    const campground = this.selectedCampground();

    const alert: CreateAlertDto = {
      name: this.form.get('name')?.value || this.getDefaultName(),
      parkSystem: park.parkSystem,
      parkId: park.id,
      parkName: park.name,
      campgroundId: campground?.id,
      campgroundName: campground?.name,
      siteTypes: this.selectedSiteTypes(),
      dateRangeStart: this.form.get('dateRangeStart')?.value,
      dateRangeEnd: this.form.get('dateRangeEnd')?.value,
      flexibleDates: this.form.get('flexibleDates')?.value,
      minNights: this.form.get('minNights')?.value,
      maxNights: this.form.get('maxNights')?.value,
    };

    this.alertsService.createAlert(alert).subscribe({
      next: (created) => {
        this.router.navigate(['/alerts', created.id]);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to create alert');
        this.loading.set(false);
      },
    });
  }
}
