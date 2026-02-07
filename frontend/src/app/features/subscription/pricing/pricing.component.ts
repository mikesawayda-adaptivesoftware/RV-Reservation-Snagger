import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SubscriptionService, PricingTier, BillingInterval } from '../../../core/services/subscription.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <header class="page-header">
        <h1>Choose Your Plan</h1>
        <p>Get notified faster with premium plans</p>
      </header>

      <main class="page-content">
        <!-- Billing Toggle -->
        <div class="billing-toggle">
          <button 
            [class.active]="billingInterval() === 'monthly'"
            (click)="setBillingInterval('monthly')"
          >
            Monthly
          </button>
          <button 
            [class.active]="billingInterval() === 'yearly'"
            (click)="setBillingInterval('yearly')"
          >
            Yearly <span class="save-badge">Save 17%</span>
          </button>
        </div>

        @if (subscriptionService.isLoading()) {
          <div class="loading">Loading pricing...</div>
        } @else {
          <div class="pricing-grid">
            @for (tier of subscriptionService.pricingTiers(); track tier.id) {
              <div 
                class="pricing-card"
                [class.popular]="tier.id === 'standard'"
                [class.current]="tier.id === subscriptionService.currentTier()"
              >
                @if (tier.id === 'standard') {
                  <div class="popular-badge">Most Popular</div>
                }
                @if (tier.id === subscriptionService.currentTier()) {
                  <div class="current-badge">Current Plan</div>
                }

                <h2>{{ tier.name }}</h2>
                <p class="tier-description">{{ tier.description }}</p>

                <div class="price">
                  @if (tier.id === 'free') {
                    <span class="amount">Free</span>
                  } @else {
                    <span class="currency">$</span>
                    <span class="amount">{{ billingInterval() === 'monthly' ? tier.priceMonthly : (tier.priceYearly / 12).toFixed(2) }}</span>
                    <span class="period">/month</span>
                  }
                </div>

                @if (tier.id !== 'free' && billingInterval() === 'yearly') {
                  <p class="billed-yearly">Billed \${{ tier.priceYearly }}/year</p>
                }

                <ul class="features">
                  @for (feature of tier.features; track feature) {
                    <li>✓ {{ feature }}</li>
                  }
                </ul>

                <div class="card-action">
                  @if (tier.id === subscriptionService.currentTier()) {
                    <button class="btn btn-current" disabled>Current Plan</button>
                  } @else if (tier.id === 'free') {
                    <span class="free-note">Included with signup</span>
                  } @else if (!authService.isAuthenticated()) {
                    <a routerLink="/auth/register" class="btn btn-primary">Get Started</a>
                  } @else {
                    <button 
                      class="btn btn-primary"
                      [disabled]="subscribing()"
                      (click)="subscribe(tier)"
                    >
                      {{ subscribing() ? 'Processing...' : 'Upgrade' }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- FAQ Section -->
        <section class="faq">
          <h2>Frequently Asked Questions</h2>
          <div class="faq-grid">
            <div class="faq-item">
              <h3>How does billing work?</h3>
              <p>You'll be charged immediately upon subscribing. Your subscription renews automatically each billing period until you cancel.</p>
            </div>
            <div class="faq-item">
              <h3>Can I change plans?</h3>
              <p>Yes! You can upgrade or downgrade at any time. Changes take effect immediately and are prorated.</p>
            </div>
            <div class="faq-item">
              <h3>How do I cancel?</h3>
              <p>You can cancel anytime from your account settings. You'll retain access until the end of your billing period.</p>
            </div>
            <div class="faq-item">
              <h3>Is there a refund policy?</h3>
              <p>We offer a 7-day money-back guarantee. If you're not satisfied, contact us for a full refund.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; background: #f8f9fa; }
    .page-header { background: #2E7D32; color: white; padding: 3rem 2rem; text-align: center; }
    .page-header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .page-header p { opacity: 0.9; font-size: 1.125rem; }
    .page-content { max-width: 1100px; margin: 0 auto; padding: 2rem; }
    
    .billing-toggle { display: flex; justify-content: center; gap: 0; margin-bottom: 2rem; }
    .billing-toggle button { padding: 0.75rem 1.5rem; border: 2px solid #2E7D32; background: white; cursor: pointer; font-weight: 500; }
    .billing-toggle button:first-child { border-radius: 8px 0 0 8px; }
    .billing-toggle button:last-child { border-radius: 0 8px 8px 0; border-left: none; }
    .billing-toggle button.active { background: #2E7D32; color: white; }
    .save-badge { background: #FFC107; color: #333; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem; }
    
    .loading { text-align: center; padding: 3rem; color: #666; }
    
    .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
    
    .pricing-card { background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); position: relative; display: flex; flex-direction: column; }
    .pricing-card.popular { border: 3px solid #2E7D32; transform: scale(1.02); }
    .pricing-card.current { border: 3px solid #1565C0; }
    
    .popular-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #2E7D32; color: white; padding: 0.25rem 1rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .current-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #1565C0; color: white; padding: 0.25rem 1rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    
    .pricing-card h2 { font-size: 1.5rem; color: #1a1a1a; margin-bottom: 0.5rem; }
    .tier-description { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; min-height: 40px; }
    
    .price { margin-bottom: 0.5rem; }
    .currency { font-size: 1.5rem; color: #1a1a1a; vertical-align: top; }
    .amount { font-size: 3rem; font-weight: bold; color: #1a1a1a; }
    .period { color: #666; }
    .billed-yearly { font-size: 0.875rem; color: #666; margin-bottom: 1rem; }
    
    .features { list-style: none; padding: 0; margin: 1.5rem 0; flex: 1; }
    .features li { padding: 0.5rem 0; color: #333; font-size: 0.875rem; }
    
    .card-action { margin-top: auto; }
    .btn { display: block; width: 100%; padding: 0.875rem; border-radius: 8px; font-weight: 600; text-align: center; cursor: pointer; border: none; text-decoration: none; }
    .btn-primary { background: #2E7D32; color: white; }
    .btn-primary:hover:not(:disabled) { background: #1B5E20; }
    .btn-primary:disabled { background: #A5D6A7; cursor: not-allowed; }
    .btn-current { background: #e0e0e0; color: #666; }
    .free-note { display: block; text-align: center; color: #666; font-size: 0.875rem; }
    
    .faq { margin-top: 3rem; }
    .faq h2 { text-align: center; margin-bottom: 2rem; color: #1a1a1a; }
    .faq-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
    .faq-item { background: white; padding: 1.5rem; border-radius: 12px; }
    .faq-item h3 { font-size: 1rem; color: #1a1a1a; margin-bottom: 0.5rem; }
    .faq-item p { color: #666; font-size: 0.875rem; line-height: 1.5; }
  `],
})
export class PricingComponent implements OnInit {
  subscriptionService = inject(SubscriptionService);
  authService = inject(AuthService);

  billingInterval = signal<BillingInterval>('monthly');
  subscribing = signal(false);

  ngOnInit() {
    this.subscriptionService.fetchPricingTiers().subscribe();
    if (this.authService.isAuthenticated()) {
      this.subscriptionService.fetchCurrentSubscription().subscribe();
    }
  }

  setBillingInterval(interval: BillingInterval) {
    this.billingInterval.set(interval);
  }

  async subscribe(tier: PricingTier) {
    this.subscribing.set(true);
    try {
      await this.subscriptionService.redirectToCheckout(tier.id, this.billingInterval());
    } catch (err) {
      console.error('Subscription error:', err);
      this.subscribing.set(false);
    }
  }
}
