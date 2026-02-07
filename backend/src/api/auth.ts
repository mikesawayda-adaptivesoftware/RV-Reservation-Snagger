import { Router, Request, Response, NextFunction } from 'express';
import { auth, db, COLLECTIONS } from '../config/firebase';
import { UserProfile, NotificationPreferences, ApiResponse } from '../../shared/types';
import { logger } from '../services/logger';

const router = Router();

// Middleware to verify Firebase ID token
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

// Create or update user profile after authentication
router.post('/profile', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userRef = db.collection(COLLECTIONS.USERS).doc(user.uid);
    const userDoc = await userRef.get();

    const defaultNotificationPreferences: NotificationPreferences = {
      methods: ['email'],
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: 'America/Los_Angeles',
    };

    if (!userDoc.exists) {
      // Create new user profile
      const newProfile: Omit<UserProfile, 'id'> = {
        email: user.email || '',
        displayName: user.name || user.email?.split('@')[0] || null,
        phoneNumber: user.phone_number || null,
        photoURL: user.picture || null,
        notificationPreferences: defaultNotificationPreferences,
        subscriptionTier: 'free',
        stripeCustomerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await userRef.set(newProfile);
      
      const response: ApiResponse<UserProfile> = {
        success: true,
        data: { id: user.uid, ...newProfile },
        message: 'Profile created successfully',
      };
      res.status(201).json(response);
    } else {
      // Update last login
      await userRef.update({ updatedAt: new Date() });
      
      const response: ApiResponse<UserProfile> = {
        success: true,
        data: { id: user.uid, ...userDoc.data() } as UserProfile,
      };
      res.json(response);
    }
  } catch (error) {
    logger.error('Error creating/updating profile:', error);
    res.status(500).json({ success: false, error: 'Failed to process profile' });
  }
});

// Get user profile
router.get('/profile', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();

    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    const response: ApiResponse<UserProfile> = {
      success: true,
      data: { id: user.uid, ...userDoc.data() } as UserProfile,
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.patch('/profile', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { displayName, phoneNumber, notificationPreferences } = req.body;

    const updateData: Partial<UserProfile> = {
      updatedAt: new Date(),
    };

    if (displayName !== undefined) updateData.displayName = displayName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (notificationPreferences !== undefined) {
      updateData.notificationPreferences = notificationPreferences;
    }

    await db.collection(COLLECTIONS.USERS).doc(user.uid).update(updateData);

    const updatedDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
    
    const response: ApiResponse<UserProfile> = {
      success: true,
      data: { id: user.uid, ...updatedDoc.data() } as UserProfile,
      message: 'Profile updated successfully',
    };
    res.json(response);
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

export default router;
