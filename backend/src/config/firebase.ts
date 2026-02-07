import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
const initializeFirebase = (): admin.app.App => {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error(
      'Missing Firebase configuration. Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables.'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey,
      clientEmail,
    }),
  });
};

// Initialize and export
const app = initializeFirebase();
export const db = admin.firestore();
export const auth = admin.auth();

// Firestore collection names
export const COLLECTIONS = {
  USERS: 'users',
  ALERTS: 'alerts',
  SUBSCRIPTIONS: 'subscriptions',
  ALERT_MATCHES: 'alertMatches',
  NOTIFICATIONS: 'notifications',
  SCRAPE_LOGS: 'scrapeLogs',
} as const;

export default app;
