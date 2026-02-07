import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService, PaginatedResponse } from './api.service';
import { Observable, tap } from 'rxjs';

export type ParkSystem = 'recreation_gov' | 'reserve_america' | 'reserve_california';
export type SiteType = 'tent' | 'rv' | 'cabin' | 'group';

export interface CampsiteAlert {
  id: string;
  userId: string;
  name: string;
  parkSystem: ParkSystem;
  parkId: string;
  parkName: string;
  campgroundId: string | null;
  campgroundName: string | null;
  siteTypes: SiteType[];
  dateRangeStart: Date;
  dateRangeEnd: Date;
  flexibleDates: boolean;
  minNights: number;
  maxNights: number;
  specificSiteIds: string[] | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastChecked: Date | null;
  matchesFound: number;
}

export interface AlertMatch {
  id: string;
  alertId: string;
  userId: string;
  parkSystem: ParkSystem;
  parkName: string;
  campgroundName: string;
  siteName: string;
  siteId: string;
  siteType: SiteType;
  availableDates: { start: Date; end: Date }[];
  reservationUrl: string;
  foundAt: Date;
  notifiedAt: Date | null;
  isExpired: boolean;
}

export interface CreateAlertDto {
  name?: string;
  parkSystem: ParkSystem;
  parkId: string;
  parkName: string;
  campgroundId?: string;
  campgroundName?: string;
  siteTypes: SiteType[];
  dateRangeStart: string;
  dateRangeEnd: string;
  flexibleDates?: boolean;
  minNights?: number;
  maxNights?: number;
  specificSiteIds?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AlertsService {
  private api = inject(ApiService);

  // Signals for state management
  private alertsSignal = signal<CampsiteAlert[]>([]);
  private loadingSignal = signal<boolean>(false);
  private totalAlertsSignal = signal<number>(0);

  // Public computed signals
  alerts = computed(() => this.alertsSignal());
  activeAlerts = computed(() => this.alertsSignal().filter((a) => a.isActive));
  isLoading = computed(() => this.loadingSignal());
  totalAlerts = computed(() => this.totalAlertsSignal());

  // Fetch all alerts
  fetchAlerts(page: number = 1, pageSize: number = 20, active?: boolean): Observable<PaginatedResponse<CampsiteAlert>> {
    this.loadingSignal.set(true);
    
    const params: Record<string, any> = { page, pageSize };
    if (active !== undefined) {
      params['active'] = active;
    }

    return this.api.get<PaginatedResponse<CampsiteAlert>>('/alerts', params).pipe(
      tap((response) => {
        this.alertsSignal.set(response.items);
        this.totalAlertsSignal.set(response.total);
        this.loadingSignal.set(false);
      })
    );
  }

  // Get single alert
  getAlert(id: string): Observable<CampsiteAlert> {
    return this.api.get<CampsiteAlert>(`/alerts/${id}`);
  }

  // Create new alert
  createAlert(alert: CreateAlertDto): Observable<CampsiteAlert> {
    return this.api.post<CampsiteAlert>('/alerts', alert).pipe(
      tap((newAlert) => {
        this.alertsSignal.update((alerts) => [newAlert, ...alerts]);
        this.totalAlertsSignal.update((total) => total + 1);
      })
    );
  }

  // Update alert
  updateAlert(id: string, updates: Partial<CampsiteAlert>): Observable<CampsiteAlert> {
    return this.api.patch<CampsiteAlert>(`/alerts/${id}`, updates).pipe(
      tap((updatedAlert) => {
        this.alertsSignal.update((alerts) =>
          alerts.map((a) => (a.id === id ? updatedAlert : a))
        );
      })
    );
  }

  // Toggle alert active status
  toggleAlert(id: string, isActive: boolean): Observable<CampsiteAlert> {
    return this.updateAlert(id, { isActive });
  }

  // Delete alert
  deleteAlert(id: string): Observable<void> {
    return this.api.delete<void>(`/alerts/${id}`).pipe(
      tap(() => {
        this.alertsSignal.update((alerts) => alerts.filter((a) => a.id !== id));
        this.totalAlertsSignal.update((total) => total - 1);
      })
    );
  }

  // Get matches for an alert
  getAlertMatches(alertId: string, page: number = 1, pageSize: number = 20): Observable<PaginatedResponse<AlertMatch>> {
    return this.api.get<PaginatedResponse<AlertMatch>>(`/alerts/${alertId}/matches`, { page, pageSize });
  }

  // Manually trigger a check for an alert
  checkAlertNow(alertId: string): Observable<{ matchesFound: number }> {
    return this.api.post<{ matchesFound: number }>(`/alerts/${alertId}/check`, {});
  }
}
