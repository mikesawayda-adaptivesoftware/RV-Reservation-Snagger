import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  // Generic GET request
  get<T>(endpoint: string, params?: Record<string, any>): Observable<T> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }

    return this.http
      .get<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, { params: httpParams })
      .pipe(map((response) => this.handleResponse(response)));
  }

  // Generic POST request
  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body)
      .pipe(map((response) => this.handleResponse(response)));
  }

  // Generic PATCH request
  patch<T>(endpoint: string, body: any): Observable<T> {
    return this.http
      .patch<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body)
      .pipe(map((response) => this.handleResponse(response)));
  }

  // Generic DELETE request
  delete<T>(endpoint: string): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(`${this.baseUrl}${endpoint}`)
      .pipe(map((response) => this.handleResponse(response)));
  }

  private handleResponse<T>(response: ApiResponse<T>): T {
    if (response.success && response.data !== undefined) {
      return response.data;
    }
    throw new Error(response.error || 'An error occurred');
  }
}
