import { CampsiteAlert, SiteType, DateRange } from '../../shared/types';
import { config } from '../config';
import { logger } from '../services/logger';

/**
 * Represents an available campsite found by a scraper
 */
export interface AvailableSite {
  siteId: string;
  siteName: string;
  siteType: SiteType;
  campgroundId: string;
  campgroundName: string;
  availableDates: DateRange[];
  reservationUrl: string;
  loop?: string;
  amenities?: string[];
}

/**
 * Base class for all park scrapers
 */
export abstract class BaseScraper {
  protected name: string;
  protected baseUrl: string;
  protected userAgent: string;
  protected timeout: number;
  protected retryAttempts: number;
  protected retryDelay: number;

  constructor(name: string, baseUrl: string) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.userAgent = config.scraper.userAgent;
    this.timeout = config.scraper.requestTimeout;
    this.retryAttempts = config.scraper.retryAttempts;
    this.retryDelay = config.scraper.retryDelay;
  }

  /**
   * Check availability for a given alert
   * Returns array of available sites matching the alert criteria
   */
  abstract checkAvailability(alert: CampsiteAlert): Promise<AvailableSite[]>;

  /**
   * Get the reservation URL for a specific site
   */
  abstract getReservationUrl(siteId: string, campgroundId: string): string;

  /**
   * Helper to retry failed requests
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          `${this.name} ${context} attempt ${attempt}/${this.retryAttempts} failed:`,
          lastError.message
        );

        if (attempt < this.retryAttempts) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Filter available sites based on alert criteria
   */
  protected filterByCriteria(
    sites: AvailableSite[],
    alert: CampsiteAlert
  ): AvailableSite[] {
    return sites.filter((site) => {
      // Filter by site type
      if (!alert.siteTypes.includes(site.siteType)) {
        return false;
      }

      // Filter by specific site IDs if specified
      if (alert.specificSiteIds && alert.specificSiteIds.length > 0) {
        if (!alert.specificSiteIds.includes(site.siteId)) {
          return false;
        }
      }

      // Filter by campground if specified
      if (alert.campgroundId && site.campgroundId !== alert.campgroundId) {
        return false;
      }

      // Filter available dates to match the alert's date range
      const alertStart = this.parseDate(alert.dateRangeStart);
      const alertEnd = this.parseDate(alert.dateRangeEnd);

      const matchingDates = site.availableDates.filter((dateRange) => {
        const rangeStart = new Date(dateRange.start);
        const rangeEnd = new Date(dateRange.end);

        // Check if there's any overlap with the alert's date range
        return rangeStart <= alertEnd && rangeEnd >= alertStart;
      });

      if (matchingDates.length === 0) {
        return false;
      }

      // Check minimum stay requirement
      const hasValidStay = matchingDates.some((dateRange) => {
        const nights = this.getNightsBetween(
          new Date(dateRange.start),
          new Date(dateRange.end)
        );
        return nights >= alert.minNights && nights <= alert.maxNights;
      });

      if (!hasValidStay) {
        return false;
      }

      // Update the site with filtered dates
      site.availableDates = matchingDates;

      return true;
    });
  }

  /**
   * Calculate nights between two dates
   */
  protected getNightsBetween(start: Date, end: Date): number {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format date for API requests (YYYY-MM-DD)
   */
  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse a date that may be a Firestore Timestamp, Date, or string
   */
  protected parseDate(date: Date | string | { _seconds: number; _nanoseconds?: number } | { seconds: number; nanoseconds?: number }): Date {
    if (!date) {
      throw new Error('Date is required');
    }

    // Handle Firestore Timestamp objects (from REST API - has _seconds)
    if (typeof date === 'object' && '_seconds' in date) {
      return new Date(date._seconds * 1000);
    }

    // Handle Firestore Timestamp objects (from Admin SDK - has seconds)
    if (typeof date === 'object' && 'seconds' in date && typeof (date as any).seconds === 'number') {
      return new Date((date as any).seconds * 1000);
    }

    // Handle Firestore Timestamp with toDate method
    if (typeof date === 'object' && typeof (date as any).toDate === 'function') {
      return (date as any).toDate();
    }

    // Handle Date objects
    if (date instanceof Date) {
      return date;
    }

    // Handle strings
    if (typeof date === 'string') {
      return new Date(date);
    }

    // Last resort - try to construct a Date
    return new Date(date as any);
  }
}
