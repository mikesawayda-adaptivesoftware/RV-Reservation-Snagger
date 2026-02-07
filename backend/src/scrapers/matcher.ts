import { v4 as uuidv4 } from 'uuid';
import { db, COLLECTIONS } from '../config/firebase';
import { CampsiteAlert, AlertMatch, NotificationMethod } from '../../../shared/types';
import { AvailableSite } from './base';
import { logger } from '../services/logger';
import { sendNotifications } from '../notifications';

/**
 * Process available sites found by scrapers
 * - Deduplicate against existing matches
 * - Save new matches to Firestore
 * - Trigger notifications
 */
export async function processMatches(
  alert: CampsiteAlert,
  availableSites: AvailableSite[]
): Promise<AlertMatch[]> {
  const newMatches: AlertMatch[] = [];

  // Get user's notification preferences
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(alert.userId).get();
  const userData = userDoc.data();

  if (!userData) {
    logger.error(`User not found for alert ${alert.id}`);
    return [];
  }

  const notificationMethods = userData.notificationPreferences?.methods || ['email'];

  // Get existing matches for this alert to avoid duplicates
  const existingMatchesSnapshot = await db
    .collection(COLLECTIONS.ALERT_MATCHES)
    .where('alertId', '==', alert.id)
    .where('isExpired', '==', false)
    .get();

  const existingMatches = new Set<string>();
  existingMatchesSnapshot.docs.forEach((doc) => {
    const match = doc.data() as AlertMatch;
    // Create a unique key for deduplication
    const key = `${match.siteId}-${JSON.stringify(match.availableDates)}`;
    existingMatches.add(key);
  });

  for (const site of availableSites) {
    // Check for duplicates
    const matchKey = `${site.siteId}-${JSON.stringify(site.availableDates)}`;
    
    if (existingMatches.has(matchKey)) {
      logger.debug(`Skipping duplicate match for site ${site.siteId}`);
      continue;
    }

    // Create new match record
    const matchId = uuidv4();
    const match: AlertMatch = {
      id: matchId,
      alertId: alert.id,
      userId: alert.userId,
      parkSystem: alert.parkSystem,
      parkName: alert.parkName,
      campgroundName: site.campgroundName,
      siteName: site.siteName,
      siteId: site.siteId,
      siteType: site.siteType,
      availableDates: site.availableDates,
      reservationUrl: site.reservationUrl,
      foundAt: new Date(),
      notifiedAt: null,
      notificationMethods: notificationMethods as NotificationMethod[],
      isExpired: false,
    };

    // Save to Firestore
    await db.collection(COLLECTIONS.ALERT_MATCHES).doc(matchId).set(match);
    newMatches.push(match);

    // Update alert match count
    await db.collection(COLLECTIONS.ALERTS).doc(alert.id).update({
      matchesFound: (alert.matchesFound || 0) + 1,
      updatedAt: new Date(),
    });

    logger.info(`New match found for alert ${alert.id}: ${site.siteName}`);
  }

  // Send notifications for new matches
  if (newMatches.length > 0) {
    try {
      await sendNotifications(userData, alert, newMatches);

      // Update matches with notification timestamp
      const batch = db.batch();
      for (const match of newMatches) {
        const matchRef = db.collection(COLLECTIONS.ALERT_MATCHES).doc(match.id);
        batch.update(matchRef, { notifiedAt: new Date() });
      }
      await batch.commit();
    } catch (error) {
      logger.error('Error sending notifications:', error);
    }
  }

  return newMatches;
}

/**
 * Mark matches as expired when dates have passed
 * Run this periodically (e.g., daily) to clean up old matches
 */
export async function expireOldMatches(): Promise<void> {
  const now = new Date();

  const matchesSnapshot = await db
    .collection(COLLECTIONS.ALERT_MATCHES)
    .where('isExpired', '==', false)
    .get();

  const batch = db.batch();
  let expiredCount = 0;

  for (const doc of matchesSnapshot.docs) {
    const match = doc.data() as AlertMatch;
    
    // Check if all available dates have passed
    const allDatesExpired = match.availableDates.every((range) => {
      const endDate = new Date(range.end);
      return endDate < now;
    });

    if (allDatesExpired) {
      batch.update(doc.ref, { isExpired: true });
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    await batch.commit();
    logger.info(`Expired ${expiredCount} old matches`);
  }
}
