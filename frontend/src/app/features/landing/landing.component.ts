import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="landing">
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-content">
          <h1>Never Miss a Campsite Again</h1>
          <p class="hero-subtitle">
            Get instant alerts when your favorite campsites become available.
            We monitor Recreation.gov, ReserveAmerica, and more.
          </p>
          <div class="hero-cta">
            @if (authService.isAuthenticated()) {
              <a routerLink="/dashboard" class="btn btn-primary">Go to Dashboard</a>
            } @else {
              <a routerLink="/auth/register" class="btn btn-primary">Get Started Free</a>
              <a routerLink="/auth/login" class="btn btn-secondary">Sign In</a>
            }
          </div>
        </div>
        <div class="hero-image">
          <div class="hero-placeholder">🏕️</div>
        </div>
      </section>

      <!-- How It Works -->
      <section class="how-it-works">
        <h2>How It Works</h2>
        <div class="steps">
          <div class="step">
            <div class="step-icon">🔍</div>
            <h3>1. Set Your Alert</h3>
            <p>Choose your park, campground, dates, and site type preferences.</p>
          </div>
          <div class="step">
            <div class="step-icon">⏰</div>
            <h3>2. We Monitor 24/7</h3>
            <p>Our system checks for availability every 10-60 minutes based on your plan.</p>
          </div>
          <div class="step">
            <div class="step-icon">📱</div>
            <h3>3. Get Notified</h3>
            <p>Receive instant email or SMS alerts when a site becomes available.</p>
          </div>
          <div class="step">
            <div class="step-icon">🎉</div>
            <h3>4. Book Your Site</h3>
            <p>Click the link in your notification to book before anyone else.</p>
          </div>
        </div>
      </section>

      <!-- Supported Parks -->
      <section class="parks">
        <h2>Parks We Monitor</h2>
        <div class="park-systems">
          <div class="park-system">
            <h3>Recreation.gov</h3>
            <p>National Parks, National Forests, BLM, Army Corps</p>
          </div>
          <div class="park-system">
            <h3>ReserveAmerica</h3>
            <p>State Parks across multiple states</p>
          </div>
          <div class="park-system">
            <h3>ReserveCalifornia</h3>
            <p>California State Parks</p>
          </div>
        </div>
      </section>

      <!-- Pricing Preview -->
      <section class="pricing-preview">
        <h2>Simple, Affordable Pricing</h2>
        <p>Start free, upgrade when you need more alerts and faster notifications.</p>
        <a routerLink="/subscription/pricing" class="btn btn-primary">View Pricing</a>
      </section>

      <!-- Footer -->
      <footer class="footer">
        <p>&copy; 2024 RV Reservation Snagger. All rights reserved.</p>
      </footer>
    </div>
  `,
  styles: [`
    .landing {
      font-family: system-ui, -apple-system, sans-serif;
    }

    .hero {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      padding: 4rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
      align-items: center;
    }

    @media (max-width: 768px) {
      .hero {
        grid-template-columns: 1fr;
        text-align: center;
      }
    }

    .hero h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #1a1a1a;
    }

    .hero-subtitle {
      font-size: 1.25rem;
      color: #666;
      margin-bottom: 2rem;
      line-height: 1.6;
    }

    .hero-cta {
      display: flex;
      gap: 1rem;
    }

    @media (max-width: 768px) {
      .hero-cta {
        justify-content: center;
        flex-wrap: wrap;
      }
    }

    .hero-image {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .hero-placeholder {
      font-size: 12rem;
    }

    .btn {
      display: inline-block;
      padding: 0.875rem 1.75rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
    }

    .btn-primary {
      background: #2E7D32;
      color: white;
    }

    .btn-primary:hover {
      background: #1B5E20;
    }

    .btn-secondary {
      background: white;
      color: #2E7D32;
      border: 2px solid #2E7D32;
    }

    .btn-secondary:hover {
      background: #E8F5E9;
    }

    .how-it-works {
      background: #f8f9fa;
      padding: 4rem 2rem;
      text-align: center;
    }

    .how-it-works h2 {
      font-size: 2rem;
      margin-bottom: 3rem;
      color: #1a1a1a;
    }

    .steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    .step {
      padding: 1.5rem;
    }

    .step-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .step h3 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
      color: #1a1a1a;
    }

    .step p {
      color: #666;
      line-height: 1.5;
    }

    .parks {
      padding: 4rem 2rem;
      max-width: 1000px;
      margin: 0 auto;
      text-align: center;
    }

    .parks h2 {
      font-size: 2rem;
      margin-bottom: 2rem;
      color: #1a1a1a;
    }

    .park-systems {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }

    .park-system {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 1.5rem;
    }

    .park-system h3 {
      color: #2E7D32;
      margin-bottom: 0.5rem;
    }

    .park-system p {
      color: #666;
    }

    .pricing-preview {
      background: #2E7D32;
      color: white;
      padding: 4rem 2rem;
      text-align: center;
    }

    .pricing-preview h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    .pricing-preview p {
      font-size: 1.125rem;
      margin-bottom: 2rem;
      opacity: 0.9;
    }

    .pricing-preview .btn-primary {
      background: white;
      color: #2E7D32;
    }

    .pricing-preview .btn-primary:hover {
      background: #f0f0f0;
    }

    .footer {
      background: #1a1a1a;
      color: #999;
      padding: 2rem;
      text-align: center;
    }
  `],
})
export class LandingComponent {
  authService = inject(AuthService);
}
