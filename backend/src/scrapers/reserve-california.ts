import { CampsiteAlert, SiteType } from '../../../shared/types';
import { BaseScraper, AvailableSite } from './base';
import { logger } from '../services/logger';

/**
 * ReserveCalifornia Scraper
 * 
 * ReserveCalifornia handles California State Park reservations.
 * This scraper uses their web interface since there's no public API.
 * 
 * Note: For production, use Puppeteer/Playwright for JavaScript-rendered content.
 */
export class ReserveCaliforniaScraper extends BaseScraper {
  constructor() {
    super('ReserveCalifornia', 'https://www.reservecalifornia.com');
  }

  async checkAvailability(alert: CampsiteAlert): Promise<AvailableSite[]> {
    logger.info(`Checking ReserveCalifornia availability for park ${alert.parkId}`);

    try {
      const startDate = this.formatDate(this.parseDate(alert.dateRangeStart));
      const endDate = this.formatDate(this.parseDate(alert.dateRangeEnd));

      const availableSites = await this.withRetry(
        () => this.fetchAvailability(alert.parkId, alert.campgroundId, startDate, endDate),
        `fetching availability for ${alert.parkId}`
      );

      // Filter by alert criteria
      const filteredSites = this.filterByCriteria(availableSites, alert);

      logger.info(
        `ReserveCalifornia: Found ${filteredSites.length} matching sites for alert ${alert.id}`
      );

      return filteredSites;
    } catch (error) {
      logger.error(`ReserveCalifornia scraper error:`, error);
      throw error;
    }
  }

  private async fetchAvailability(
    parkId: string,
    campgroundId: string | null,
    startDate: string,
    endDate: string
  ): Promise<AvailableSite[]> {
    // ReserveCalifornia uses an AJAX API for availability data
    // The API endpoint and structure may change - verify current implementation
    
    const facilityId = campgroundId || parkId;
    
    // ReserveCalifornia API for grid availability
    const apiUrl = `${this.baseUrl}/CaliforniaWebHome/Facilities/AdvanceSearch.aspx/GetAvailability`;

    const requestBody = {
      outfitterId: 0,
      facilityId: parseInt(facilityId, 10),
      startDate: startDate,
      endDate: endDate,
      isADA: false,
      equipmentId: -32768,
      subEquipmentId: -32768,
      partySize: 1,
      categoryId: 0,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      // Fall back to HTML scraping if API fails
      return this.fetchAvailabilityFromHtml(facilityId, startDate, endDate);
    }

    const data = await response.json();
    return this.parseApiResponse(data, facilityId);
  }

  private async fetchAvailabilityFromHtml(
    facilityId: string,
    startDate: string,
    endDate: string
  ): Promise<AvailableSite[]> {
    // Fallback HTML scraping method
    const searchUrl = `${this.baseUrl}/CaliforniaWebHome/Facilities/SearchViewUnitAvailab498ilty.aspx`;
    
    const params = new URLSearchParams({
      FacilityId: facilityId,
      ArrivalDate: startDate,
      DepartureDate: endDate,
    });

    const response = await fetch(`${searchUrl}?${params.toString()}`, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`ReserveCalifornia error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseHtmlResponse(html, facilityId);
  }

  private parseApiResponse(data: any, facilityId: string): AvailableSite[] {
    const availableSites: AvailableSite[] = [];

    // Parse the API response structure
    // The actual structure depends on ReserveCalifornia's API
    
    if (!data.d || !data.d.Units) {
      return [];
    }

    for (const unit of data.d.Units) {
      const availableDates: { start: Date; end: Date }[] = [];

      // Parse availability from the unit data
      if (unit.Availabilities) {
        let rangeStart: Date | null = null;
        let rangeEnd: Date | null = null;

        for (const avail of unit.Availabilities) {
          if (avail.IsAvailable) {
            const date = new Date(avail.Date);
            
            if (!rangeStart) {
              rangeStart = date;
              rangeEnd = date;
            } else if (rangeEnd) {
              const nextDay = new Date(rangeEnd);
              nextDay.setDate(nextDay.getDate() + 1);

              if (date.getTime() === nextDay.getTime()) {
                rangeEnd = date;
              } else {
                availableDates.push({ start: rangeStart, end: rangeEnd });
                rangeStart = date;
                rangeEnd = date;
              }
            }
          } else if (rangeStart && rangeEnd) {
            availableDates.push({ start: rangeStart, end: rangeEnd });
            rangeStart = null;
            rangeEnd = null;
          }
        }

        if (rangeStart && rangeEnd) {
          availableDates.push({ start: rangeStart, end: rangeEnd });
        }
      }

      if (availableDates.length > 0) {
        availableSites.push({
          siteId: unit.UnitId?.toString() || '',
          siteName: unit.Name || `Site ${unit.UnitId}`,
          siteType: this.determineSiteType(unit),
          campgroundId: facilityId,
          campgroundName: unit.FacilityName || 'Unknown',
          availableDates,
          reservationUrl: this.getReservationUrl(unit.UnitId?.toString() || '', facilityId),
          loop: unit.Loop,
        });
      }
    }

    return availableSites;
  }

  private parseHtmlResponse(html: string, facilityId: string): AvailableSite[] {
    // Placeholder for HTML parsing
    // In production, use cheerio or similar
    logger.debug('ReserveCalifornia HTML parsing not yet implemented');
    return [];
  }

  private determineSiteType(unit: any): SiteType {
    const unitType = (unit.UnitTypeName || unit.CategoryName || '').toLowerCase();

    if (unitType.includes('cabin') || unitType.includes('yurt') || unitType.includes('lodge')) {
      return 'cabin';
    }
    if (unitType.includes('rv') || unitType.includes('hookup') || unitType.includes('electric')) {
      return 'rv';
    }
    if (unitType.includes('group')) {
      return 'group';
    }
    return 'tent';
  }

  getReservationUrl(siteId: string, campgroundId: string): string {
    return `${this.baseUrl}/CaliforniaWebHome/Facilities/SearchViewUnitAvailability.aspx?FacilityId=${campgroundId}&UnitId=${siteId}`;
  }
}
