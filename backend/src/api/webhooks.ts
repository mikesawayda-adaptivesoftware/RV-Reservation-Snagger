import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db, COLLECTIONS } from '../config/firebase';
import { config } from '../config';
import { Subscription, SubscriptionStatus, SubscriptionTier } from '../../shared/types';
import { PRICING_TIERS } from '../config/pricing';
import { logger } from '../services/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

// Map Stripe price IDs to tier IDs
function getTierFromPriceId(priceId: string): SubscriptionTier {
  for (const [tierId, tier] of Object.entries(PRICING_TIERS)) {
    if (tier.stripePriceIdMonthly === priceId || tier.stripePriceIdYearly === priceId) {
      return tierId as SubscriptionTier;
    }
  }
  return 'free';
}

// Stripe webhook handler
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err: any) {
    logger.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const firebaseUid = session.metadata?.firebaseUid;
  const tierId = session.metadata?.tierId as SubscriptionTier;

  if (!firebaseUid || !tierId) {
    logger.error('Missing metadata in checkout session');
    return;
  }

  // Get the subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);

  // Create subscription record in Firestore
  const subscriptionId = uuidv4();
  const subscription: Subscription = {
    id: subscriptionId,
    userId: firebaseUid,
    tier: tierId,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: stripeSubscription.items.data[0].price.id,
    status: stripeSubscription.status as SubscriptionStatus,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection(COLLECTIONS.SUBSCRIPTIONS).doc(subscriptionId).set(subscription);

  // Update user's subscription tier
  await db.collection(COLLECTIONS.USERS).doc(firebaseUid).update({
    subscriptionTier: tierId,
    updatedAt: new Date(),
  });

  logger.info(`Subscription created for user ${firebaseUid}: ${tierId}`);
}

async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  const customerId = stripeSubscription.customer as string;

  // Find user by Stripe customer ID
  const usersSnapshot = await db
    .collection(COLLECTIONS.USERS)
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  const userId = usersSnapshot.docs[0].id;
  const priceId = stripeSubscription.items.data[0].price.id;
  const newTier = getTierFromPriceId(priceId);

  // Update subscription record
  const subscriptionsSnapshot = await db
    .collection(COLLECTIONS.SUBSCRIPTIONS)
    .where('stripeSubscriptionId', '==', stripeSubscription.id)
    .limit(1)
    .get();

  if (!subscriptionsSnapshot.empty) {
    await subscriptionsSnapshot.docs[0].ref.update({
      tier: newTier,
      stripePriceId: priceId,
      status: stripeSubscription.status as SubscriptionStatus,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      updatedAt: new Date(),
    });
  }

  // Update user's tier
  await db.collection(COLLECTIONS.USERS).doc(userId).update({
    subscriptionTier: newTier,
    updatedAt: new Date(),
  });

  logger.info(`Subscription updated for user ${userId}: ${newTier}`);
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const customerId = stripeSubscription.customer as string;

  // Find user by Stripe customer ID
  const usersSnapshot = await db
    .collection(COLLECTIONS.USERS)
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  const userId = usersSnapshot.docs[0].id;

  // Update subscription record
  const subscriptionsSnapshot = await db
    .collection(COLLECTIONS.SUBSCRIPTIONS)
    .where('stripeSubscriptionId', '==', stripeSubscription.id)
    .limit(1)
    .get();

  if (!subscriptionsSnapshot.empty) {
    await subscriptionsSnapshot.docs[0].ref.update({
      status: 'canceled' as SubscriptionStatus,
      updatedAt: new Date(),
    });
  }

  // Downgrade user to free tier
  await db.collection(COLLECTIONS.USERS).doc(userId).update({
    subscriptionTier: 'free',
    updatedAt: new Date(),
  });

  logger.info(`Subscription canceled for user ${userId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Find user by Stripe customer ID
  const usersSnapshot = await db
    .collection(COLLECTIONS.USERS)
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    logger.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  const userId = usersSnapshot.docs[0].id;
  
  // TODO: Send email notification about failed payment
  logger.warn(`Payment failed for user ${userId}`);
}

export default router;
