import { Router, Request, Response } from 'express';
import { db, COLLECTIONS } from '../config/firebase';
import { verifyToken } from './auth';
import { CampsiteAlert, ApiResponse, PaginatedResponse, AlertMatch } from '../../../shared/types';
import { PRICING_TIERS } from '../config/pricing';
import { logger } from '../services/logger';
import { v4 as uuidv4 } from 'uuid';
import { runScraperForAlert } from '../scrapers';

const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// Create a new alert
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      name,
      parkSystem,
      parkId,
      parkName,
      campgroundId,
      campgroundName,
      siteTypes,
      dateRangeStart,
      dateRangeEnd,
      flexibleDates,
      minNights,
      maxNights,
      specificSiteIds,
    } = req.body;

    // Get user's subscription tier to check alert limits
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const userData = userDoc.data()!;
    const tier = PRICING_TIERS[userData.subscriptionTier as keyof typeof PRICING_TIERS];

    // Count existing active alerts
    const existingAlerts = await db
      .collection(COLLECTIONS.ALERTS)
      .where('userId', '==', user.uid)
      .where('isActive', '==', true)
      .get();

    if (existingAlerts.size >= tier.maxAlerts) {
      res.status(400).json({
        success: false,
        error: `You have reached the maximum number of alerts (${tier.maxAlerts}) for your subscription tier. Please upgrade to add more alerts.`,
      });
      return;
    }

    // Validate campground selection for Recreation.gov (required for availability API)
    if (parkSystem === 'recreation_gov' && !campgroundId) {
      res.status(400).json({
        success: false,
        error: 'Please select a specific campground for Recreation.gov alerts. The availability API requires a campground selection.',
      });
      return;
    }

    // Create the alert
    const alertId = uuidv4();
    const newAlert: CampsiteAlert = {
      id: alertId,
      userId: user.uid,
      name: name || `${parkName} Alert`,
      parkSystem,
      parkId,
      parkName,
      campgroundId: campgroundId || null,
      campgroundName: campgroundName || null,
      siteTypes: siteTypes || ['tent', 'rv'],
      dateRangeStart: new Date(dateRangeStart),
      dateRangeEnd: new Date(dateRangeEnd),
      flexibleDates: flexibleDates || false,
      minNights: minNights || 1,
      maxNights: maxNights || 14,
      specificSiteIds: specificSiteIds || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastChecked: null,
      matchesFound: 0,
    };

    await db.collection(COLLECTIONS.ALERTS).doc(alertId).set(newAlert);

    const response: ApiResponse<CampsiteAlert> = {
      success: true,
      data: newAlert,
      message: 'Alert created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

// Get all alerts for the current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { page = 1, pageSize = 20, active } = req.query;

    let query = db.collection(COLLECTIONS.ALERTS).where('userId', '==', user.uid);

    if (active !== undefined) {
      query = query.where('isActive', '==', active === 'true');
    }

    query = query.orderBy('createdAt', 'desc');

    const snapshot = await query.get();
    const alerts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CampsiteAlert[];

    // Simple pagination
    const startIndex = (Number(page) - 1) * Number(pageSize);
    const paginatedAlerts = alerts.slice(startIndex, startIndex + Number(pageSize));

    const response: ApiResponse<PaginatedResponse<CampsiteAlert>> = {
      success: true,
      data: {
        items: paginatedAlerts,
        total: alerts.length,
        page: Number(page),
        pageSize: Number(pageSize),
        hasMore: startIndex + Number(pageSize) < alerts.length,
      },
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

// Get a specific alert
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const alertDoc = await db.collection(COLLECTIONS.ALERTS).doc(id).get();

    if (!alertDoc.exists) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    const alert = { id: alertDoc.id, ...alertDoc.data() } as CampsiteAlert;

    if (alert.userId !== user.uid) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const response: ApiResponse<CampsiteAlert> = {
      success: true,
      data: alert,
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alert' });
  }
});

// Update an alert
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const updateFields = req.body;

    const alertDoc = await db.collection(COLLECTIONS.ALERTS).doc(id).get();

    if (!alertDoc.exists) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    const alert = alertDoc.data() as CampsiteAlert;

    if (alert.userId !== user.uid) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Only allow updating specific fields
    const allowedFields = [
      'name',
      'siteTypes',
      'dateRangeStart',
      'dateRangeEnd',
      'flexibleDates',
      'minNights',
      'maxNights',
      'specificSiteIds',
      'isActive',
    ];

    const updateData: Partial<CampsiteAlert> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        (updateData as any)[field] = updateFields[field];
      }
    }

    await db.collection(COLLECTIONS.ALERTS).doc(id).update(updateData);

    const updatedDoc = await db.collection(COLLECTIONS.ALERTS).doc(id).get();
    const response: ApiResponse<CampsiteAlert> = {
      success: true,
      data: { id: updatedDoc.id, ...updatedDoc.data() } as CampsiteAlert,
      message: 'Alert updated successfully',
    };
    res.json(response);
  } catch (error) {
    logger.error('Error updating alert:', error);
    res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

// Delete an alert
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const alertDoc = await db.collection(COLLECTIONS.ALERTS).doc(id).get();

    if (!alertDoc.exists) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    const alert = alertDoc.data() as CampsiteAlert;

    if (alert.userId !== user.uid) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    await db.collection(COLLECTIONS.ALERTS).doc(id).delete();

    const response: ApiResponse<null> = {
      success: true,
      message: 'Alert deleted successfully',
    };
    res.json(response);
  } catch (error) {
    logger.error('Error deleting alert:', error);
    res.status(500).json({ success: false, error: 'Failed to delete alert' });
  }
});

// Manually trigger a scrape for an alert (development/testing)
router.post('/:id/check', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const alertDoc = await db.collection(COLLECTIONS.ALERTS).doc(id).get();

    if (!alertDoc.exists) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    const alert = { id: alertDoc.id, ...alertDoc.data() } as CampsiteAlert;

    if (alert.userId !== user.uid) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (!alert.isActive) {
      res.status(400).json({ success: false, error: 'Alert is not active' });
      return;
    }

    logger.info(`Manual check triggered for alert ${id}`);

    // Run the scraper for this alert
    const matches = await runScraperForAlert(alert);

    // Update last checked timestamp
    await db.collection(COLLECTIONS.ALERTS).doc(id).update({
      lastChecked: new Date(),
    });

    const response: ApiResponse<{ matchesFound: number }> = {
      success: true,
      data: { matchesFound: matches?.length || 0 },
      message: `Check completed. Found ${matches?.length || 0} matches.`,
    };
    res.json(response);
  } catch (error) {
    logger.error('Error running manual check:', error);
    res.status(500).json({ success: false, error: 'Failed to run check' });
  }
});

// Get matches for an alert
router.get('/:id/matches', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    // Verify ownership
    const alertDoc = await db.collection(COLLECTIONS.ALERTS).doc(id).get();
    if (!alertDoc.exists) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    const alert = alertDoc.data() as CampsiteAlert;
    if (alert.userId !== user.uid) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Get matches
    const matchesSnapshot = await db
      .collection(COLLECTIONS.ALERT_MATCHES)
      .where('alertId', '==', id)
      .orderBy('foundAt', 'desc')
      .get();

    const matches = matchesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AlertMatch[];

    // Paginate
    const startIndex = (Number(page) - 1) * Number(pageSize);
    const paginatedMatches = matches.slice(startIndex, startIndex + Number(pageSize));

    const response: ApiResponse<PaginatedResponse<AlertMatch>> = {
      success: true,
      data: {
        items: paginatedMatches,
        total: matches.length,
        page: Number(page),
        pageSize: Number(pageSize),
        hasMore: startIndex + Number(pageSize) < matches.length,
      },
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching matches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch matches' });
  }
});

export default router;
