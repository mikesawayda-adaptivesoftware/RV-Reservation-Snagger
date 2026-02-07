import { CampsiteAlert, AlertMatch, ParkSystem } from '../../../shared/types';
import { logger } from '../services/logger';
import { RecreationGovScraper } from './recreation-gov';
import { ReserveAmericaScraper } from './reserve-america';
import { ReserveCaliforniaScraper } from './reserve-california';
import { BaseScraper } from './base';
import { processMatches } from './matcher';

// Scraper registry
const scrapers: Record<ParkSystem, BaseScraper> = {
  recreation_gov: new RecreationGovScraper(),
  reserve_america: new ReserveAmericaScraper(),
  reserve_california: new ReserveCaliforniaScraper(),
};

/**
 * Run the appropriate scraper for an alert and process any matches
 */
export async function runScraperForAlert(alert: CampsiteAlert): Promise<AlertMatch[]> {
  const scraper = scrapers[alert.parkSystem];

  if (!scraper) {
    logger.error(`No scraper found for park system: ${alert.parkSystem}`);
    return [];
  }

  logger.info(`Running ${alert.parkSystem} scraper for alert ${alert.id}`);

  try {
    // Run the scraper
    const availability = await scraper.checkAvailability(alert);

    if (availability.length === 0) {
      logger.debug(`No availability found for alert ${alert.id}`);
      return [];
    }

    logger.info(`Found ${availability.length} available slots for alert ${alert.id}`);

    // Process matches (save to DB, send notifications)
    const matches = await processMatches(alert, availability);

    return matches;
  } catch (error) {
    logger.error(`Scraper error for alert ${alert.id}:`, error);
    throw error;
  }
}

export { BaseScraper } from './base';
export { RecreationGovScraper } from './recreation-gov';
export { ReserveAmericaScraper } from './reserve-america';
export { ReserveCaliforniaScraper } from './reserve-california';
