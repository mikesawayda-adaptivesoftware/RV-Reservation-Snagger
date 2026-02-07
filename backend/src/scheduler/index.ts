import cron from 'node-cron';
import { db, COLLECTIONS } from '../config/firebase';
import { PRICING_TIERS } from '../config/pricing';
import { CampsiteAlert, SubscriptionTier } from '../../shared/types';
import { logger } from '../services/logger';
import { runScraperForAlert } from '../scrapers';

// Track running jobs to prevent overlaps
const runningJobs = new Set<string>();

/**
 * Start the scheduler that runs scrapers based on subscription tiers
 */
export function startScheduler(): void {
  logger.info('Starting scraper scheduler...');

  // Premium tier: every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    processAlertsForTier('premium');
  });

  // Standard tier: every 30 minutes
  cron.schedule('*/30 * * * *', () => {
    processAlertsForTier('standard');
  });

  // Basic tier: every hour
  cron.schedule('0 * * * *', () => {
    processAlertsForTier('basic');
  });

  logger.info('Scheduler started successfully');
}

/**
 * Process all active alerts for a given subscription tier
 */
async function processAlertsForTier(tier: SubscriptionTier): Promise<void> {
  const jobId = `${tier}-${Date.now()}`;
  
  if (runningJobs.has(tier)) {
    logger.warn(`Skipping ${tier} tier job - previous job still running`);
    return;
  }

  runningJobs.add(tier);
  logger.info(`Starting scrape job for ${tier} tier (job: ${jobId})`);

  try {
    // Get all users with this subscription tier
    const usersSnapshot = await db
      .collection(COLLECTIONS.USERS)
      .where('subscriptionTier', '==', tier)
      .get();

    const userIds = usersSnapshot.docs.map((doc) => doc.id);
    logger.debug(`Found ${userIds.length} users for ${tier} tier: ${userIds.join(', ')}`);

    if (userIds.length === 0) {
      logger.info(`No users found for ${tier} tier`);
      return;
    }

    // Get all active alerts for these users
    // Note: Firestore doesn't support 'in' with more than 10 items,
    // so we need to batch this in production
    const alertsToProcess: CampsiteAlert[] = [];

    for (const userId of userIds) {
      const alertsSnapshot = await db
        .collection(COLLECTIONS.ALERTS)
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      logger.debug(`User ${userId}: found ${alertsSnapshot.size} active alerts`);

      alertsSnapshot.docs.forEach((doc) => {
        const alert = { id: doc.id, ...doc.data() } as CampsiteAlert;
        logger.debug(`Alert ${doc.id}: dateRangeEnd = ${JSON.stringify(alert.dateRangeEnd)}`);
        
        // Only process alerts with valid date ranges (not expired)
        let endDate: Date;
        if (alert.dateRangeEnd instanceof Date) {
          endDate = alert.dateRangeEnd;
        } else if (typeof alert.dateRangeEnd === 'object' && '_seconds' in (alert.dateRangeEnd as any)) {
          // Handle Firestore Timestamp
          endDate = new Date((alert.dateRangeEnd as any)._seconds * 1000);
        } else {
          endDate = new Date(alert.dateRangeEnd);
        }
        
        logger.debug(`Alert ${doc.id}: parsed endDate = ${endDate.toISOString()}, now = ${new Date().toISOString()}`);
        
        if (endDate > new Date()) {
          alertsToProcess.push(alert);
        } else {
          logger.debug(`Alert ${doc.id}: skipped - expired`);
        }
      });
    }

    logger.info(`Found ${alertsToProcess.length} active alerts for ${tier} tier`);

    // Process each alert
    for (const alert of alertsToProcess) {
      try {
        await runScraperForAlert(alert);
        
        // Update last checked timestamp
        await db.collection(COLLECTIONS.ALERTS).doc(alert.id).update({
          lastChecked: new Date(),
        });
      } catch (error) {
        logger.error(`Error processing alert ${alert.id}:`, error);
      }

      // Small delay between alerts to avoid rate limiting
      await sleep(2000);
    }

    logger.info(`Completed scrape job for ${tier} tier (job: ${jobId})`);
  } catch (error) {
    logger.error(`Error in ${tier} tier job:`, error);
  } finally {
    runningJobs.delete(tier);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { startScheduler };
