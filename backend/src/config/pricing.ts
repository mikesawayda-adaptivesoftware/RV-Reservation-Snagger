import { PricingTier, SubscriptionTier } from '../../shared/types';

/**
 * Pricing Configuration
 * 
 * Update these values to configure your subscription pricing.
 * Make sure to create corresponding products and prices in Stripe Dashboard
 * and update the stripe price IDs accordingly.
 */
export const PRICING_TIERS: Record<SubscriptionTier, PricingTier> = {
  free: {
    id: 'free',
    name: 'Free Trial',
    description: 'Try out the service with limited features',
    scrapeIntervalMinutes: 0, // No automatic scraping
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: '',
    stripePriceIdYearly: '',
    maxAlerts: 1,
    features: [
      '1 active alert',
      'Manual availability check only',
      'Email notifications',
    ],
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'Perfect for occasional campers',
    scrapeIntervalMinutes: 60,
    priceMonthly: 4.99, // Configure your price
    priceYearly: 49.99, // Configure your price
    stripePriceIdMonthly: 'price_basic_monthly', // Replace with actual Stripe price ID
    stripePriceIdYearly: 'price_basic_yearly',   // Replace with actual Stripe price ID
    maxAlerts: 5,
    features: [
      'Up to 5 active alerts',
      'Checks every 60 minutes',
      'Email notifications',
      'SMS notifications',
    ],
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'For regular campers who want the best spots',
    scrapeIntervalMinutes: 30,
    priceMonthly: 9.99, // Configure your price
    priceYearly: 99.99, // Configure your price
    stripePriceIdMonthly: 'price_standard_monthly', // Replace with actual Stripe price ID
    stripePriceIdYearly: 'price_standard_yearly',   // Replace with actual Stripe price ID
    maxAlerts: 15,
    features: [
      'Up to 15 active alerts',
      'Checks every 30 minutes',
      'Email notifications',
      'SMS notifications',
      'Priority support',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Maximum chance to snag that perfect campsite',
    scrapeIntervalMinutes: 10,
    priceMonthly: 19.99, // Configure your price
    priceYearly: 199.99, // Configure your price
    stripePriceIdMonthly: 'price_premium_monthly', // Replace with actual Stripe price ID
    stripePriceIdYearly: 'price_premium_yearly',   // Replace with actual Stripe price ID
    maxAlerts: 50,
    features: [
      'Up to 50 active alerts',
      'Checks every 10 minutes',
      'Email notifications',
      'SMS notifications',
      'Priority support',
      'Early access to new features',
    ],
  },
};

/**
 * Get the pricing tier configuration for a given tier ID
 */
export function getPricingTier(tierId: SubscriptionTier): PricingTier {
  return PRICING_TIERS[tierId];
}

/**
 * Get all pricing tiers as an array (useful for displaying pricing page)
 */
export function getAllPricingTiers(): PricingTier[] {
  return Object.values(PRICING_TIERS);
}

/**
 * Get the scrape interval in milliseconds for a given tier
 */
export function getScrapeIntervalMs(tierId: SubscriptionTier): number {
  const tier = PRICING_TIERS[tierId];
  return tier.scrapeIntervalMinutes * 60 * 1000;
}
