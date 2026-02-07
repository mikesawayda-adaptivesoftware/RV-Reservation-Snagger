import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { ParkSystem, SiteType } from './alerts.service';

export interface ParkSearchResult {
  id: string;
  name: string;
  parkSystem: ParkSystem;
  state: string;
  description: string | null;
  imageUrl: string | null;
  campgroundCount: number;
}

export interface CampgroundSearchResult {
  id: string;
  parkId: string;
  name: string;
  parkSystem: ParkSystem;
  siteTypes: SiteType[];
  totalSites: number;
  description: string | null;
  amenities: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ParksService {
  private api = inject(ApiService);

  // Search parks
  searchParks(query?: string, system?: ParkSystem, state?: string): Observable<ParkSearchResult[]> {
    const params: Record<string, any> = {};
    if (query) params['q'] = query;
    if (system) params['system'] = system;
    if (state) params['state'] = state;

    return this.api.get<ParkSearchResult[]>('/parks/search', params);
  }

  // Get park details
  getPark(system: ParkSystem, parkId: string): Observable<ParkSearchResult> {
    return this.api.get<ParkSearchResult>(`/parks/${system}/${parkId}`);
  }

  // Get campgrounds for a park
  getCampgrounds(system: ParkSystem, parkId: string): Observable<CampgroundSearchResult[]> {
    return this.api.get<CampgroundSearchResult[]>(`/parks/${system}/${parkId}/campgrounds`);
  }

  // Get campground details
  getCampground(system: ParkSystem, parkId: string, campgroundId: string): Observable<CampgroundSearchResult> {
    return this.api.get<CampgroundSearchResult>(`/parks/${system}/${parkId}/campgrounds/${campgroundId}`);
  }

  // Get park system display name
  getParkSystemName(system: ParkSystem): string {
    switch (system) {
      case 'recreation_gov':
        return 'Recreation.gov';
      case 'reserve_america':
        return 'ReserveAmerica';
      case 'reserve_california':
        return 'ReserveCalifornia';
      default:
        return system;
    }
  }

  // Get site type display name
  getSiteTypeName(type: SiteType): string {
    switch (type) {
      case 'tent':
        return 'Tent';
      case 'rv':
        return 'RV/Trailer';
      case 'cabin':
        return 'Cabin/Yurt';
      case 'group':
        return 'Group Site';
      default:
        return type;
    }
  }
}
