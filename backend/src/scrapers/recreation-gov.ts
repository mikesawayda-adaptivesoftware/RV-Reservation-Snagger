import { CampsiteAlert, SiteType } from '../../../shared/types';
import { BaseScraper, AvailableSite } from './base';
import { logger } from '../services/logger';

/**
 * Recreation.gov Scraper
 * 
 * Recreation.gov has a public API that can be used to check availability.
 * API Documentation: https://ridb.recreation.gov/docs
 * 
 * Note: For production use, you may need to register for an API key.
 */
export class RecreationGovScraper extends BaseScraper {
  private apiKey: string;

  constructor() {
    super('RecreationGov', 'https://www.recreation.gov');
    this.apiKey = process.env.RECREATION_GOV_API_KEY || '';
  }

  async checkAvailability(alert: CampsiteAlert): Promise<AvailableSite[]> {
    logger.info(`Checking Recreation.gov availability for park ${alert.parkId}`);

    try {
      const startDate = this.formatDate(this.parseDate(alert.dateRangeStart));
      const endDate = this.formatDate(this.parseDate(alert.dateRangeEnd));

      // Recreation.gov availability API requires a specific campground/facility ID
      // The parkId (recAreaId) won't work - we need a facility ID
      if (!alert.campgroundId) {
        logger.warn(`Alert ${alert.id} has no campground selected. Recreation.gov requires a specific campground.`);
        throw new Error('No campground selected. Please edit your alert to select a specific campground.');
      }
      
      const campgroundId = alert.campgroundId;
      
      const availableSites = await this.withRetry(
        () => this.fetchAvailability(campgroundId, startDate, endDate),
        `fetching availability for ${campgroundId}`
      );

      // Filter by alert criteria
      const filteredSites = this.filterByCriteria(availableSites, alert);

      logger.info(
        `Recreation.gov: Found ${filteredSites.length} matching sites for alert ${alert.id}`
      );

      return filteredSites;
    } catch (error) {
      logger.error(`Recreation.gov scraper error:`, error);
      throw error;
    }
  }

  private async fetchAvailability(
    campgroundId: string,
    startDate: string,
    endDate: string
  ): Promise<AvailableSite[]> {
    // Recreation.gov API URL for availability
    // Format: /api/camps/availability/campground/{campgroundId}/month?start_date=YYYY-MM-01T00:00:00.000Z
    const baseUrl = `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month`;

    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Accept: 'application/json',
    };

    if (this.apiKey) {
      headers['apikey'] = this.apiKey;
    }

    // Get all months we need to query (from start to end date)
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const months: string[] = [];
    
    let currentDate = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), 1);
    while (currentDate <= endDateObj) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}-01T00:00:00.000Z`);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    logger.debug(`Fetching availability for ${months.length} month(s): ${months.join(', ')}`);

    // Fetch all months and combine results
    const allSites: AvailableSite[] = [];
    
    for (const monthStart of months) {
      const url = `${baseUrl}?start_date=${encodeURIComponent(monthStart)}`;
      logger.debug(`Fetching: ${url}`);
      
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        logger.error(`Recreation.gov API error response: ${errorText}`);
        
        // Handle "not found" specifically - this campground may not be reservable on Recreation.gov
        if (response.status === 404 || errorText.includes('not found')) {
          throw new Error(`Campground ${campgroundId} not found on Recreation.gov. It may not be reservable through Recreation.gov.`);
        }
        
        throw new Error(`Recreation.gov API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse the response and add to results
      const monthSites = this.parseAvailabilityResponse(data, campgroundId, startDate, endDate);
      allSites.push(...monthSites);
      
      // Small delay between requests to avoid rate limiting
      if (months.length > 1) {
        await this.sleep(500);
      }
    }

    // Deduplicate sites (in case same site appears in multiple months)
    const siteMap = new Map<string, AvailableSite>();
    for (const site of allSites) {
      if (siteMap.has(site.siteId)) {
        // Merge available dates
        const existing = siteMap.get(site.siteId)!;
        existing.availableDates.push(...site.availableDates);
      } else {
        siteMap.set(site.siteId, site);
      }
    }

    return Array.from(siteMap.values());
  }

  private parseAvailabilityResponse(
    data: any,
    campgroundId: string,
    startDate: string,
    endDate: string
  ): AvailableSite[] {
    const availableSites: AvailableSite[] = [];

    // Recreation.gov response structure:
    // { campsites: { [siteId]: { availabilities: { [date]: status }, ... } } }
    
    if (!data.campsites) {
      return [];
    }

    const requestStartDate = new Date(startDate);
    const requestEndDate = new Date(endDate);

    for (const [siteId, siteData] of Object.entries(data.campsites as Record<string, any>)) {
      const availabilities = siteData.availabilities || {};
      const availableDates: { start: Date; end: Date }[] = [];

      let currentRangeStart: Date | null = null;
      let currentRangeEnd: Date | null = null;

      // Sort dates and find consecutive available ranges
      const sortedDates = Object.keys(availabilities).sort();

      for (const dateStr of sortedDates) {
        const status = availabilities[dateStr];
        const date = new Date(dateStr);

        // Skip dates outside our range
        if (date < requestStartDate || date > requestEndDate) {
          continue;
        }

        // Check if the site is available (status can be 'Available', 'Open', etc.)
        const isAvailable = status === 'Available' || status === 'Open';

        if (isAvailable) {
          if (!currentRangeStart) {
            currentRangeStart = date;
            currentRangeEnd = date;
          } else if (currentRangeEnd) {
            // Check if this date is consecutive
            const nextDay = new Date(currentRangeEnd);
            nextDay.setDate(nextDay.getDate() + 1);

            if (date.getTime() === nextDay.getTime()) {
              currentRangeEnd = date;
            } else {
              // Save current range and start new one
              availableDates.push({
                start: currentRangeStart,
                end: currentRangeEnd,
              });
              currentRangeStart = date;
              currentRangeEnd = date;
            }
          }
        } else {
          // Site not available on this date
          if (currentRangeStart && currentRangeEnd) {
            availableDates.push({
              start: currentRangeStart,
              end: currentRangeEnd,
            });
            currentRangeStart = null;
            currentRangeEnd = null;
          }
        }
      }

      // Don't forget the last range
      if (currentRangeStart && currentRangeEnd) {
        availableDates.push({
          start: currentRangeStart,
          end: currentRangeEnd,
        });
      }

      if (availableDates.length > 0) {
        availableSites.push({
          siteId,
          siteName: siteData.site || `Site ${siteId}`,
          siteType: this.determineSiteType(siteData),
          campgroundId,
          campgroundName: siteData.campground_name || 'Unknown Campground',
          availableDates,
          reservationUrl: this.getReservationUrl(siteId, campgroundId),
          loop: siteData.loop,
        });
      }
    }

    return availableSites;
  }

  private determineSiteType(siteData: any): SiteType {
    const siteType = (siteData.campsite_type || '').toLowerCase();
    const equipment = (siteData.equipment_allowed || []).join(' ').toLowerCase();

    if (siteType.includes('cabin') || siteType.includes('yurt')) {
      return 'cabin';
    }
    if (siteType.includes('rv') || equipment.includes('rv') || siteType.includes('electric')) {
      return 'rv';
    }
    if (siteType.includes('group')) {
      return 'group';
    }
    return 'tent';
  }

  getReservationUrl(siteId: string, campgroundId: string): string {
    return `https://www.recreation.gov/camping/campsites/${siteId}`;
  }
}
