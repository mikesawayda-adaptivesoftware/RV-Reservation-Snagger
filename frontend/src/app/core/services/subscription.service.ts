import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, tap } from 'rxjs';

export type SubscriptionTier = 'free' | 'basic' | 'standard' | 'premium';
export type BillingInterval = 'monthly' | 'yearly';

export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  scrapeIntervalMinutes: number;
  priceMonthly: number;
  priceYearly: number;
  maxAlerts: number;
  features: string[];
}

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionService {
  private api = inject(ApiService);

  // Signals
  private pricingTiersSignal = signal<PricingTier[]>([]);
  private currentSubscriptionSignal = signal<Subscription | null>(null);
  private currentTierSignal = signal<SubscriptionTier>('free');
  private loadingSignal = signal<boolean>(false);

  // Public computed signals
  pricingTiers = computed(() => this.pricingTiersSignal());
  currentSubscription = computed(() => this.currentSubscriptionSignal());
  currentTier = computed(() => this.currentTierSignal());
  isLoading = computed(() => this.loadingSignal());

  currentTierDetails = computed(() => {
    const tier = this.currentTierSignal();
    return this.pricingTiersSignal().find((t) => t.id === tier) || null;
  });

  // Fetch pricing tiers (public endpoint)
  fetchPricingTiers(): Observable<PricingTier[]> {
    this.loadingSignal.set(true);
    
    return this.api.get<PricingTier[]>('/subscription/pricing').pipe(
      tap((tiers) => {
        this.pricingTiersSignal.set(tiers);
        this.loadingSignal.set(false);
      })
    );
  }

  // Fetch current subscription
  fetchCurrentSubscription(): Observable<{ tier: SubscriptionTier; subscription: Subscription | null }> {
    return this.api.get<{ tier: SubscriptionTier; subscription: Subscription | null }>('/subscription/current').pipe(
      tap((response) => {
        this.currentTierSignal.set(response.tier);
        this.currentSubscriptionSignal.set(response.subscription);
      })
    );
  }

  // Create checkout session for new subscription
  createCheckoutSession(tierId: SubscriptionTier, billingInterval: BillingInterval = 'monthly'): Observable<CheckoutSession> {
    return this.api.post<CheckoutSession>('/subscription/checkout', { tierId, billingInterval });
  }

  // Redirect to Stripe checkout
  async redirectToCheckout(tierId: SubscriptionTier, billingInterval: BillingInterval = 'monthly'): Promise<void> {
    const session = await this.createCheckoutSession(tierId, billingInterval).toPromise();
    
    if (session?.url) {
      window.location.href = session.url;
    }
  }

  // Create billing portal session
  createPortalSession(): Observable<{ url: string }> {
    return this.api.post<{ url: string }>('/subscription/portal', {});
  }

  // Redirect to Stripe billing portal
  async redirectToPortal(): Promise<void> {
    const session = await this.createPortalSession().toPromise();
    
    if (session?.url) {
      window.location.href = session.url;
    }
  }

  // Helper to check if user can create more alerts
  canCreateAlert(currentAlertCount: number): boolean {
    const tierDetails = this.currentTierDetails();
    if (!tierDetails) return false;
    return currentAlertCount < tierDetails.maxAlerts;
  }

  // Get scrape interval display text
  getScrapeIntervalText(tier: SubscriptionTier): string {
    const tierDetails = this.pricingTiersSignal().find((t) => t.id === tier);
    if (!tierDetails || tierDetails.scrapeIntervalMinutes === 0) {
      return 'Manual only';
    }
    if (tierDetails.scrapeIntervalMinutes === 60) {
      return 'Every hour';
    }
    return `Every ${tierDetails.scrapeIntervalMinutes} minutes`;
  }
}
