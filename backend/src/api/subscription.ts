import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db, COLLECTIONS } from '../config/firebase';
import { verifyToken } from './auth';
import { config } from '../config';
import { PRICING_TIERS, getAllPricingTiers } from '../config/pricing';
import { ApiResponse, PricingTier, Subscription, SubscriptionTier } from '../../shared/types';
import { logger } from '../services/logger';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

// Get all pricing tiers (public endpoint)
router.get('/pricing', async (req: Request, res: Response) => {
  try {
    const tiers = getAllPricingTiers();
    const response: ApiResponse<PricingTier[]> = {
      success: true,
      data: tiers,
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching pricing:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pricing' });
  }
});

// Create Stripe checkout session
router.post('/checkout', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { tierId, billingInterval = 'monthly' } = req.body;

    if (!tierId || !['basic', 'standard', 'premium'].includes(tierId)) {
      res.status(400).json({ success: false, error: 'Invalid tier selected' });
      return;
    }

    const tier = PRICING_TIERS[tierId as SubscriptionTier];
    const priceId =
      billingInterval === 'yearly' ? tier.stripePriceIdYearly : tier.stripePriceIdMonthly;

    if (!priceId) {
      res.status(400).json({ success: false, error: 'Pricing not configured for this tier' });
      return;
    }

    // Get or create Stripe customer
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
    const userData = userDoc.data();
    let customerId = userData?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          firebaseUid: user.uid,
        },
      });
      customerId = customer.id;

      // Save customer ID to user profile
      await db.collection(COLLECTIONS.USERS).doc(user.uid).update({
        stripeCustomerId: customerId,
        updatedAt: new Date(),
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${config.frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/subscription/cancel`,
      metadata: {
        firebaseUid: user.uid,
        tierId,
        billingInterval,
      },
    });

    const response: ApiResponse<{ sessionId: string; url: string }> = {
      success: true,
      data: {
        sessionId: session.id,
        url: session.url!,
      },
    };
    res.json(response);
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

// Create Stripe billing portal session
router.post('/portal', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData?.stripeCustomerId) {
      res.status(400).json({ success: false, error: 'No subscription found' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: `${config.frontendUrl}/dashboard`,
    });

    const response: ApiResponse<{ url: string }> = {
      success: true,
      data: { url: session.url },
    };
    res.json(response);
  } catch (error) {
    logger.error('Error creating portal session:', error);
    res.status(500).json({ success: false, error: 'Failed to create portal session' });
  }
});

// Get current subscription
router.get('/current', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // First check the subscriptions collection (for Stripe-managed subscriptions)
    const subscriptionDoc = await db
      .collection(COLLECTIONS.SUBSCRIPTIONS)
      .where('userId', '==', user.uid)
      .limit(1)
      .get();

    if (!subscriptionDoc.empty) {
      const subscription = {
        id: subscriptionDoc.docs[0].id,
        ...subscriptionDoc.docs[0].data(),
      } as Subscription;

      const response: ApiResponse<{ tier: SubscriptionTier; subscription: Subscription }> = {
        success: true,
        data: {
          tier: subscription.tier,
          subscription,
        },
      };
      res.json(response);
      return;
    }

    // Fallback: check the user's subscriptionTier field (for manual/dev upgrades)
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
    const userData = userDoc.data();
    const userTier = (userData?.subscriptionTier as SubscriptionTier) || 'free';

    const response: ApiResponse<{ tier: SubscriptionTier; subscription: null }> = {
      success: true,
      data: {
        tier: userTier,
        subscription: null,
      },
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

export default router;
