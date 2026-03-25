import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import type * as Leaflet from 'leaflet';

import { AlertsService, CreateAlertDto, ParkSystem, SiteType } from '../../../core/services/alerts.service';
import { ParksService, ParkSearchResult, CampgroundSearchResult } from '../../../core/services/parks.service';

interface StateOption {
  code: string;
  name: string;
}

type ParkAlertabilityStatus = 'checking' | 'alertable' | 'not_alertable';

const PARK_PAGE_SIZE = 100;

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

          @if (form.get('parkSystem')?.value) {
            <section class="form-section">
              <h2>2. Pick a State</h2>
              <div class="form-group">
                <label for="stateCode">State</label>
                <select id="stateCode" formControlName="stateCode" (change)="onStateChange()">
                  <option value="">Choose a state</option>
                  @for (state of states; track state.code) {
                    <option [value]="state.code">{{ state.name }}</option>
                  }
                </select>
              </div>
              <p class="form-hint">State selection narrows the park search results before you choose campgrounds.</p>
            </section>
          }

          @if (form.get('parkSystem')?.value && form.get('stateCode')?.value) {
            <section class="form-section">
              <h2>3. Select a Park</h2>
              <div class="form-group">
                <label for="parkSearch">Search Parks</label>
                <input 
                  type="text" 
                  id="parkSearch"
                  formControlName="parkSearch"
                  placeholder="Type to filter parks in the selected state..."
                  autocomplete="off"
                />
              </div>
              <p class="form-hint">The list below is preloaded for the selected state. Use search to filter it down.</p>

              <div class="view-toggle">
                <button
                  type="button"
                  class="view-toggle-btn"
                  [class.active]="parkViewMode() === 'list'"
                  (click)="setParkViewMode('list')"
                >
                  List
                </button>
                <button
                  type="button"
                  class="view-toggle-btn"
                  [class.active]="parkViewMode() === 'map'"
                  (click)="setParkViewMode('map')"
                  [disabled]="mappableParks().length === 0"
                >
                  Map
                </button>
              </div>

              @if (searchLoading()) {
                <div class="search-loading">Loading parks...</div>
              } @else if (parkResults().length === 0 && availableParks().length === 0) {
                <div class="search-loading">No parks found for this state yet.</div>
              } @else if (parkResults().length === 0 && availableParks().length > 0 && !selectedPark()) {
                <div class="search-loading">No parks match your current filter.</div>
              }

              @if (selectedPark()) {
                <div class="selected-item">
                  <div class="selected-info">
                    <strong>{{ selectedPark()!.name }}</strong>
                    <span>{{ selectedPark()!.state }}</span>
                  </div>
                  <button type="button" class="btn-clear" (click)="clearPark()">Clear selection</button>
                </div>
              }

              @if (parkResults().length > 0) {
                <div class="selection-summary">
                  <span>{{ parkResults().length }} park(s) shown</span>
                  <span>{{ availableParks().length }} loaded for this state</span>
                </div>

                @if (parkViewMode() === 'list') {
                  <div class="search-results">
                    @for (park of parkResults(); track park.id) {
                      <button 
                        type="button" 
                        class="search-result"
                        [class.selected]="isParkSelected(park.id)"
                        (click)="selectPark(park)"
                      >
                        <span class="result-header">
                          <span class="result-name">{{ park.name }}</span>
                          @if (getParkAlertabilityStatus(park.id) === 'not_alertable') {
                            <span class="park-badge park-badge-warning">Not alertable right now</span>
                          } @else if (getParkAlertabilityStatus(park.id) === 'checking') {
                            <span class="park-badge park-badge-muted">Checking...</span>
                          }
                        </span>
                        <span class="result-meta">
                          {{ park.state }}{{ park.campgroundCount ? ' • ' + park.campgroundCount + ' campgrounds' : '' }}
                        </span>
                      </button>
                    }
                  </div>
                } @else {
                  @if (mappableParks().length > 0) {
                    <div class="park-map-shell">
                      <div #parkMap class="park-map"></div>
                    </div>
                    <p class="form-hint">Hover a pin to preview details. Click a pin to select that park. The map only shows parks with coordinates.</p>
                  } @else {
                    <div class="search-loading">No park coordinates are available for this filtered list.</div>
                  }
                }

                @if (canLoadMoreParks() && !selectedPark()) {
                  <div class="load-more-row">
                    <button
                      type="button"
                      class="btn btn-outline"
                      [disabled]="loadingMoreParks()"
                      (click)="loadMoreParks()"
                    >
                      {{ loadingMoreParks() ? 'Loading more parks...' : 'Load More Parks' }}
                    </button>
                  </div>
                }
              }
            </section>
          }

          @if (selectedPark()) {
            <section class="form-section">
              <h2>4. Select Campgrounds</h2>
              <p class="form-hint">
                Choose one or more campgrounds in {{ selectedPark()!.name }}.
                @if (isCampgroundSelectionRequired()) {
                  Recreation.gov alerts require at least one campground.
                }
              </p>
              
              @if (campgroundsLoading()) {
                <div class="loading-campgrounds">Loading campgrounds...</div>
              } @else if (campgrounds().length === 0) {
                <p class="no-campgrounds">No campgrounds found for this park.</p>
              } @else {
                <div class="toolbar-row">
                  <div class="form-group toolbar-search">
                    <label for="campgroundFilter">Filter Campgrounds</label>
                    <input
                      type="text"
                      id="campgroundFilter"
                      [value]="campgroundFilter()"
                      (input)="onCampgroundFilterChange($event)"
                      placeholder="Type campground name..."
                    />
                  </div>
                  <div class="toolbar-actions">
                    <button type="button" class="btn btn-outline btn-small" (click)="selectAllFilteredCampgrounds()">
                      Select Filtered
                    </button>
                    <button type="button" class="btn btn-secondary btn-small" (click)="clearCampgrounds()">
                      Clear All
                    </button>
                  </div>
                </div>

                <div class="selection-summary">
                  <span>{{ selectedCampgrounds().length }} campground(s) selected</span>
                  @if (filteredCampgrounds().length !== campgrounds().length) {
                    <span>{{ filteredCampgrounds().length }} matching current filter</span>
                  }
                </div>

                @if (selectedCampgrounds().length > 0) {
                  <div class="selected-chips">
                    @for (cg of selectedCampgrounds(); track cg.id) {
                      <button type="button" class="chip" (click)="toggleCampground(cg)">
                        {{ cg.name }} ×
                      </button>
                    }
                  </div>
                }

                <div class="campground-grid">
                  @for (cg of filteredCampgrounds(); track cg.id) {
                    <label class="campground-option" [class.selected]="isCampgroundSelected(cg.id)">
                      <input
                        type="checkbox"
                        [checked]="isCampgroundSelected(cg.id)"
                        (change)="toggleCampground(cg)"
                      />
                      <span class="option-content">
                        <span class="option-name">{{ cg.name }}</span>
                        <span class="option-desc">
                          {{ cg.totalSites ? cg.totalSites + ' sites' : 'Site count unavailable' }}
                        </span>
                      </span>
                    </label>
                  }
                </div>
              }
            </section>
          }

          @if (selectedPark()) {
            <section class="form-section">
              <h2>5. Select Dates</h2>
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

          @if (selectedPark()) {
            <section class="form-section">
              <h2>6. Site Preferences</h2>
              
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

          @if (selectedPark()) {
            <section class="form-section">
              <h2>7. Name Your Alert</h2>
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

    .form-group select {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      box-sizing: border-box;
      background: white;
    }

    .form-group input:focus,
    .form-group select:focus {
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

    .view-toggle {
      display: inline-flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 0.25rem;
      background: #f5f5f5;
      border-radius: 10px;
    }

    .view-toggle-btn {
      border: none;
      background: transparent;
      color: #555;
      padding: 0.5rem 0.9rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    .view-toggle-btn.active {
      background: white;
      color: #2E7D32;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    }

    .view-toggle-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
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

    .search-result.selected {
      background: #E8F5E9;
      box-shadow: inset 3px 0 0 #2E7D32;
    }

    .result-name {
      font-weight: 500;
      color: #1a1a1a;
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .result-meta {
      font-size: 0.875rem;
      color: #666;
    }

    .park-badge {
      border-radius: 999px;
      padding: 0.25rem 0.55rem;
      font-size: 0.72rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .park-badge-warning {
      background: #FFF3E0;
      color: #E65100;
    }

    .park-badge-muted {
      background: #F1F3F4;
      color: #5F6368;
    }

    .selected-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #E8F5E9;
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .btn-clear {
      background: none;
      border: none;
      color: #2E7D32;
      cursor: pointer;
      text-decoration: underline;
    }

    .toolbar-row {
      display: flex;
      gap: 1rem;
      align-items: end;
      margin-bottom: 1rem;
    }

    .toolbar-search {
      flex: 1;
      margin-bottom: 0;
    }

    .toolbar-actions {
      display: flex;
      gap: 0.5rem;
    }

    .selection-summary {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
      color: #666;
      font-size: 0.875rem;
    }

    .park-map-shell {
      border: 1px solid #ddd;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .park-map {
      height: 420px;
      width: 100%;
    }

    .load-more-row {
      display: flex;
      justify-content: center;
      margin-top: 1rem;
    }

    .selected-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .chip {
      border: none;
      background: #E8F5E9;
      color: #2E7D32;
      border-radius: 999px;
      padding: 0.4rem 0.75rem;
      cursor: pointer;
      font-size: 0.875rem;
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

    .btn-outline {
      background: white;
      color: #333;
      border: 1px solid #ddd;
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

    .btn-small {
      padding: 0.65rem 1rem;
      font-size: 0.875rem;
    }
  `],
})
export class AlertCreateComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private alertsService = inject(AlertsService);
  private parksService = inject(ParksService);

  @ViewChild('parkMap') parkMapElement?: ElementRef<HTMLDivElement>;

  loading = signal(false);
  error = signal<string | null>(null);
  searchLoading = signal(false);
  loadingMoreParks = signal(false);
  campgroundsLoading = signal(false);
  availableParks = signal<ParkSearchResult[]>([]);
  parkResults = signal<ParkSearchResult[]>([]);
  parkViewMode = signal<'list' | 'map'>('list');
  parkAlertability = signal<Record<string, ParkAlertabilityStatus>>({});
  canLoadMoreParks = signal(false);
  selectedPark = signal<ParkSearchResult | null>(null);
  campgrounds = signal<CampgroundSearchResult[]>([]);
  selectedCampgrounds = signal<CampgroundSearchResult[]>([]);
  selectedSiteTypes = signal<SiteType[]>(['tent', 'rv']);
  campgroundFilter = signal('');

  private parkMap?: Leaflet.Map;
  private parkMarkers?: Leaflet.LayerGroup;

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

  states: StateOption[] = [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' },
  ];

  form: FormGroup = this.fb.group({
    parkSystem: ['', Validators.required],
    stateCode: ['', Validators.required],
    parkSearch: [''],
    dateRangeStart: ['', Validators.required],
    dateRangeEnd: ['', Validators.required],
    flexibleDates: [false],
    minNights: [1, [Validators.required, Validators.min(1), Validators.max(14)]],
    maxNights: [7, [Validators.required, Validators.min(1), Validators.max(14)]],
    name: [''],
  });

  ngOnInit() {
    // Filter the preloaded state parks locally as the user types.
    this.form.get('parkSearch')?.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => of(query))
    ).subscribe((query) => {
      this.updateVisibleParks(query || '');
    });
  }

  ngOnDestroy() {
    this.destroyParkMap();
  }

  onParkSystemChange() {
    this.form.get('stateCode')?.setValue('');
    this.parkViewMode.set('list');
    this.resetParkSelection();
  }

  onStateChange() {
    this.resetParkSelection();
    this.loadParksForState();
  }

  selectPark(park: ParkSearchResult) {
    this.selectedPark.set(park);
    this.form.get('parkSearch')?.setValue(park.name);
    this.refreshParkMap();
    
    // Load campgrounds
    this.campgroundsLoading.set(true);
    this.campgrounds.set([]);
    this.selectedCampgrounds.set([]);
    this.campgroundFilter.set('');
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
    this.selectedCampgrounds.set([]);
    this.campgroundFilter.set('');
    this.updateVisibleParks(this.form.get('parkSearch')?.value || '');
  }

  private resetParkSelection() {
    this.selectedPark.set(null);
    this.availableParks.set([]);
    this.canLoadMoreParks.set(false);
    this.loadingMoreParks.set(false);
    this.parkAlertability.set({});
    this.campgrounds.set([]);
    this.selectedCampgrounds.set([]);
    this.campgroundFilter.set('');
    this.parkResults.set([]);
    this.form.get('parkSearch')?.setValue('');
    this.refreshParkMap();
  }

  setParkViewMode(mode: 'list' | 'map') {
    this.parkViewMode.set(mode);
    this.refreshParkMap();
  }

  private loadParksForState() {
    const state = this.form.get('stateCode')?.value;
    const system = this.form.get('parkSystem')?.value as ParkSystem | '';

    if (!state || !system) {
      return;
    }

    this.searchLoading.set(true);
    this.parksService.searchParks(undefined, system, state, { limit: PARK_PAGE_SIZE, offset: 0 }).subscribe({
      next: (parks) => {
        this.availableParks.set(parks);
        this.canLoadMoreParks.set(parks.length === PARK_PAGE_SIZE);
        this.updateVisibleParks(this.form.get('parkSearch')?.value || '');
        this.searchLoading.set(false);
      },
      error: () => {
        this.availableParks.set([]);
        this.parkResults.set([]);
        this.canLoadMoreParks.set(false);
        this.searchLoading.set(false);
      },
    });
  }

  loadMoreParks() {
    const state = this.form.get('stateCode')?.value;
    const system = this.form.get('parkSystem')?.value as ParkSystem | '';

    if (!state || !system || this.loadingMoreParks() || !this.canLoadMoreParks()) {
      return;
    }

    this.loadingMoreParks.set(true);
    this.parksService
      .searchParks(undefined, system, state, {
        limit: PARK_PAGE_SIZE,
        offset: this.availableParks().length,
      })
      .subscribe({
        next: (parks) => {
          const existing = new Map(this.availableParks().map((park) => [park.id, park]));
          for (const park of parks) {
            existing.set(park.id, park);
          }

          this.availableParks.set(Array.from(existing.values()));
          this.canLoadMoreParks.set(parks.length === PARK_PAGE_SIZE);
          this.updateVisibleParks(this.form.get('parkSearch')?.value || '');
          this.loadingMoreParks.set(false);
        },
        error: () => {
          this.loadingMoreParks.set(false);
        },
      });
  }

  private updateVisibleParks(query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    const results = this.availableParks().filter((park) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        park.name.toLowerCase().includes(normalizedQuery) ||
        park.state.toLowerCase().includes(normalizedQuery) ||
        (park.description || '').toLowerCase().includes(normalizedQuery)
      );
    });

    this.parkResults.set(results);
    this.prefetchParkAlertability(results);
    this.refreshParkMap();
  }

  private prefetchParkAlertability(parks: ParkSearchResult[]) {
    const parksToCheck = parks.slice(0, 20);

    for (const park of parksToCheck) {
      if (!this.isParkAlertabilitySupported(park)) {
        continue;
      }

      const currentStatus = this.parkAlertability()[park.id];
      if (currentStatus) {
        continue;
      }

      this.parkAlertability.update((statuses) => ({
        ...statuses,
        [park.id]: 'checking',
      }));

      this.parksService.getCampgrounds(park.parkSystem, park.id).subscribe({
        next: (campgrounds) => {
          this.parkAlertability.update((statuses) => ({
            ...statuses,
            [park.id]: campgrounds.length > 0 ? 'alertable' : 'not_alertable',
          }));
          this.refreshParkMap();
        },
        error: () => {
          this.parkAlertability.update((statuses) => ({
            ...statuses,
            [park.id]: 'not_alertable',
          }));
          this.refreshParkMap();
        },
      });
    }
  }

  private refreshParkMap() {
    setTimeout(() => {
      void this.renderParkMap();
    }, 0);
  }

  private async renderParkMap() {
    if (this.parkViewMode() !== 'map') {
      return;
    }

    const container = this.parkMapElement?.nativeElement;
    if (!container) {
      return;
    }

    const L = await import('leaflet/dist/leaflet-src.esm.js');

    if (!this.parkMap) {
      this.parkMap = L.map(container, {
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.parkMap);

      this.parkMarkers = L.layerGroup().addTo(this.parkMap);
    }

    const parkMap = this.parkMap;
    const parkMarkers = this.parkMarkers;

    if (!parkMap || !parkMarkers) {
      return;
    }

    parkMarkers.clearLayers();

    const parks = this.mappableParks();
    const selectedParkId = this.selectedPark()?.id;
    if (parks.length === 0) {
      parkMap.setView([39.8283, -98.5795], 4);
      parkMap.invalidateSize();
      return;
    }

    const bounds = L.latLngBounds([]);

    for (const park of parks) {
      const isSelected = park.id === selectedParkId;
      const alertabilityStatus = this.getParkAlertabilityStatus(park.id);
      const isNotAlertable = alertabilityStatus === 'not_alertable';
      const marker = L.circleMarker([park.latitude!, park.longitude!], {
        radius: isSelected ? 11 : 8,
        color: isSelected ? '#0D47A1' : isNotAlertable ? '#E65100' : '#1B5E20',
        weight: 2,
        fillColor: isSelected ? '#42A5F5' : isNotAlertable ? '#FFB74D' : '#43A047',
        fillOpacity: isSelected ? 0.95 : isNotAlertable ? 0.9 : 0.85,
      });

      marker.bindPopup(this.getParkPopupHtml(park, isSelected, alertabilityStatus), {
        closeButton: false,
        autoPan: true,
        className: 'park-popup',
      });
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => {
        if (!this.isParkSelected(park.id)) {
          marker.closePopup();
        }
      });
      marker.on('click', () => {
        this.selectPark(park);
        marker.openPopup();
      });
      marker.addTo(parkMarkers);
      bounds.extend([park.latitude!, park.longitude!]);

      if (isSelected) {
        marker.openPopup();
      }
    }

    if (parks.length === 1) {
      parkMap.setView([parks[0].latitude!, parks[0].longitude!], 8);
    } else {
      parkMap.fitBounds(bounds.pad(0.15));
    }

    parkMap.invalidateSize();
  }

  private destroyParkMap() {
    this.parkMarkers?.clearLayers();
    this.parkMap?.remove();
    this.parkMarkers = undefined;
    this.parkMap = undefined;
  }

  private getParkPopupHtml(
    park: ParkSearchResult,
    isSelected: boolean,
    alertabilityStatus: ParkAlertabilityStatus | null
  ): string {
    const description = park.description
      ? `${park.description.slice(0, 120)}${park.description.length > 120 ? '...' : ''}`
      : 'Park details available after selection.';
    const badgeHtml =
      alertabilityStatus === 'not_alertable'
        ? '<span class="park-popup-badge park-popup-badge-warning">Not alertable right now</span>'
        : alertabilityStatus === 'checking'
          ? '<span class="park-popup-badge park-popup-badge-muted">Checking...</span>'
          : isSelected
            ? '<span class="park-popup-badge">Selected</span>'
            : '';
    const footerText =
      alertabilityStatus === 'not_alertable'
        ? 'No usable campgrounds found for alerts right now'
        : isSelected
          ? 'Current park selection'
          : 'Click pin to select park';

    return `
      <div class="park-popup-card">
        <div class="park-popup-header">
          <div>
            <div class="park-popup-title">${park.name}</div>
            <div class="park-popup-meta">${park.state}${park.campgroundCount ? ` • ${park.campgroundCount} campgrounds` : ''}</div>
          </div>
          ${badgeHtml}
        </div>
        <div class="park-popup-body">${description}</div>
        <div class="park-popup-footer">${footerText}</div>
      </div>
    `;
  }

  onCampgroundFilterChange(event: Event) {
    const value = (event.target as HTMLInputElement | null)?.value || '';
    this.campgroundFilter.set(value);
  }

  filteredCampgrounds(): CampgroundSearchResult[] {
    const filter = this.campgroundFilter().trim().toLowerCase();
    if (!filter) {
      return this.campgrounds();
    }

    return this.campgrounds().filter((campground) =>
      campground.name.toLowerCase().includes(filter)
    );
  }

  isCampgroundSelectionRequired(): boolean {
    return this.form.get('parkSystem')?.value === 'recreation_gov';
  }

  mappableParks(): ParkSearchResult[] {
    return this.parkResults().filter(
      (park) => typeof park.latitude === 'number' && typeof park.longitude === 'number'
    );
  }

  getParkAlertabilityStatus(parkId: string): ParkAlertabilityStatus | null {
    return this.parkAlertability()[parkId] || null;
  }

  isParkSelected(parkId: string): boolean {
    return this.selectedPark()?.id === parkId;
  }

  private isParkAlertabilitySupported(park: ParkSearchResult): boolean {
    return park.parkSystem === 'recreation_gov';
  }

  isCampgroundSelected(campgroundId: string): boolean {
    return this.selectedCampgrounds().some((campground) => campground.id === campgroundId);
  }

  toggleCampground(campground: CampgroundSearchResult) {
    this.selectedCampgrounds.update((selected) => {
      if (selected.some((item) => item.id === campground.id)) {
        return selected.filter((item) => item.id !== campground.id);
      }

      return [...selected, campground].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  selectAllFilteredCampgrounds() {
    const selectedIds = new Set(this.selectedCampgrounds().map((campground) => campground.id));
    const merged = [...this.selectedCampgrounds()];

    for (const campground of this.filteredCampgrounds()) {
      if (!selectedIds.has(campground.id)) {
        merged.push(campground);
      }
    }

    this.selectedCampgrounds.set(merged.sort((a, b) => a.name.localeCompare(b.name)));
  }

  clearCampgrounds() {
    this.selectedCampgrounds.set([]);
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
    
    const selectedCampgrounds = this.selectedCampgrounds();
    if (selectedCampgrounds.length === 1) {
      return `${selectedCampgrounds[0].name} Alert`;
    }
    if (selectedCampgrounds.length > 1) {
      return `${park.name} (${selectedCampgrounds.length} campgrounds)`;
    }
    return `${park.name} Alert`;
  }

  isFormValid(): boolean {
    const park = this.selectedPark();
    const startDate = this.form.get('dateRangeStart')?.value;
    const endDate = this.form.get('dateRangeEnd')?.value;
    const siteTypes = this.selectedSiteTypes();
    const hasRequiredCampgrounds =
      !this.isCampgroundSelectionRequired() || this.selectedCampgrounds().length > 0;
    
    return !!(park && startDate && endDate && siteTypes.length > 0 && hasRequiredCampgrounds);
  }

  onSubmit() {
    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.error.set(null);

    const park = this.selectedPark()!;
    const selectedCampgrounds = this.selectedCampgrounds();

    const alert: CreateAlertDto = {
      name: this.form.get('name')?.value || this.getDefaultName(),
      parkSystem: park.parkSystem,
      parkId: park.id,
      parkName: park.name,
      stateCode: this.form.get('stateCode')?.value,
      campgroundId: selectedCampgrounds[0]?.id,
      campgroundName: selectedCampgrounds[0]?.name,
      campgroundIds: selectedCampgrounds.map((campground) => campground.id),
      campgroundNames: selectedCampgrounds.map((campground) => campground.name),
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
