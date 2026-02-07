import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionService } from '../../core/services/subscription.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="page">
      <header class="page-header">
        <a routerLink="/dashboard" class="back-link">← Back to Dashboard</a>
        <h1>Account Settings</h1>
      </header>

      <main class="page-content">
        <!-- Profile Section -->
        <section class="settings-section">
          <h2>Profile</h2>
          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" formControlName="displayName" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [value]="authService.currentUser()?.email" disabled />
              <span class="form-hint">Email cannot be changed</span>
            </div>
            <div class="form-group">
              <label>Phone Number (for SMS alerts)</label>
              <input type="tel" formControlName="phoneNumber" placeholder="+1 (555) 123-4567" />
            </div>
            <button type="submit" class="btn btn-primary" [disabled]="savingProfile()">
              {{ savingProfile() ? 'Saving...' : 'Save Changes' }}
            </button>
            @if (profileSaved()) {
              <span class="save-success">✓ Saved</span>
            }
          </form>
        </section>

        <!-- Notification Preferences -->
        <section class="settings-section">
          <h2>Notification Preferences</h2>
          <form [formGroup]="notificationForm" (ngSubmit)="saveNotifications()">
            <div class="form-group">
              <label>Notification Methods</label>
              <div class="checkbox-group">
                <label class="checkbox">
                  <input type="checkbox" formControlName="emailEnabled" />
                  <span>Email</span>
                </label>
                <label class="checkbox">
                  <input type="checkbox" formControlName="smsEnabled" />
                  <span>SMS</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="checkbox">
                <input type="checkbox" formControlName="quietHoursEnabled" />
                <span>Enable Quiet Hours (no notifications during these times)</span>
              </label>
            </div>

            @if (notificationForm.get('quietHoursEnabled')?.value) {
              <div class="quiet-hours">
                <div class="form-group">
                  <label>Start Time</label>
                  <input type="time" formControlName="quietHoursStart" />
                </div>
                <div class="form-group">
                  <label>End Time</label>
                  <input type="time" formControlName="quietHoursEnd" />
                </div>
              </div>
            }

            <div class="form-group">
              <label>Timezone</label>
              <select formControlName="timezone">
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="America/Anchorage">Alaska Time</option>
                <option value="Pacific/Honolulu">Hawaii Time</option>
              </select>
            </div>

            <button type="submit" class="btn btn-primary" [disabled]="savingNotifications()">
              {{ savingNotifications() ? 'Saving...' : 'Save Preferences' }}
            </button>
            @if (notificationsSaved()) {
              <span class="save-success">✓ Saved</span>
            }
          </form>
        </section>

        <!-- Subscription Section -->
        <section class="settings-section">
          <h2>Subscription</h2>
          <div class="subscription-info">
            <div class="current-plan">
              <span class="plan-label">Current Plan</span>
              <span class="plan-name">{{ subscriptionService.currentTier() | titlecase }}</span>
            </div>
            @if (subscriptionService.currentTierDetails(); as tier) {
              <p class="plan-details">
                {{ tier.maxAlerts }} alerts • {{ subscriptionService.getScrapeIntervalText(tier.id) }}
              </p>
            }
            <div class="subscription-actions">
              <a routerLink="/subscription/pricing" class="btn btn-secondary">Change Plan</a>
              @if (subscriptionService.currentTier() !== 'free') {
                <button class="btn btn-outline" (click)="openBillingPortal()">
                  Manage Billing
                </button>
              }
            </div>
          </div>
        </section>

        <!-- Danger Zone -->
        <section class="settings-section danger-zone">
          <h2>Danger Zone</h2>
          <p>Once you delete your account, there is no going back. Please be certain.</p>
          <button class="btn btn-danger" (click)="deleteAccount()">Delete Account</button>
        </section>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; background: #f8f9fa; }
    .page-header { background: white; padding: 1.5rem 2rem; border-bottom: 1px solid #e0e0e0; }
    .back-link { color: #2E7D32; text-decoration: none; font-size: 0.875rem; display: block; margin-bottom: 0.5rem; }
    .page-header h1 { font-size: 1.75rem; color: #1a1a1a; }
    .page-content { max-width: 700px; margin: 0 auto; padding: 2rem; }
    
    .settings-section { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .settings-section h2 { font-size: 1.125rem; color: #1a1a1a; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e0e0e0; }
    
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.875rem; color: #333; margin-bottom: 0.25rem; }
    .form-group input, .form-group select { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #2E7D32; }
    .form-group input:disabled { background: #f5f5f5; color: #666; }
    .form-hint { font-size: 0.75rem; color: #666; margin-top: 0.25rem; display: block; }
    
    .checkbox-group { display: flex; gap: 1.5rem; }
    .checkbox { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .checkbox input { width: auto; }
    
    .quiet-hours { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    
    .btn { padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; display: inline-block; }
    .btn-primary { background: #2E7D32; color: white; }
    .btn-primary:disabled { background: #A5D6A7; }
    .btn-secondary { background: #E8F5E9; color: #2E7D32; }
    .btn-outline { background: white; border: 1px solid #ddd; color: #333; }
    .btn-danger { background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; }
    
    .save-success { color: #2E7D32; margin-left: 1rem; font-size: 0.875rem; }
    
    .subscription-info { }
    .current-plan { margin-bottom: 0.5rem; }
    .plan-label { font-size: 0.75rem; color: #666; display: block; }
    .plan-name { font-size: 1.5rem; font-weight: bold; color: #2E7D32; }
    .plan-details { color: #666; margin-bottom: 1rem; }
    .subscription-actions { display: flex; gap: 0.75rem; }
    
    .danger-zone { border: 1px solid #FFCDD2; }
    .danger-zone h2 { color: #C62828; }
    .danger-zone p { color: #666; margin-bottom: 1rem; font-size: 0.875rem; }
  `],
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);
  subscriptionService = inject(SubscriptionService);
  private fb = inject(FormBuilder);

  savingProfile = signal(false);
  profileSaved = signal(false);
  savingNotifications = signal(false);
  notificationsSaved = signal(false);

  profileForm: FormGroup = this.fb.group({
    displayName: [''],
    phoneNumber: [''],
  });

  notificationForm: FormGroup = this.fb.group({
    emailEnabled: [true],
    smsEnabled: [false],
    quietHoursEnabled: [false],
    quietHoursStart: ['22:00'],
    quietHoursEnd: ['08:00'],
    timezone: ['America/Los_Angeles'],
  });

  ngOnInit() {
    this.subscriptionService.fetchCurrentSubscription().subscribe();
    
    const profile = this.authService.userProfile();
    if (profile) {
      this.profileForm.patchValue({
        displayName: profile.displayName || '',
        phoneNumber: profile.phoneNumber || '',
      });
      
      const prefs = profile.notificationPreferences;
      if (prefs) {
        this.notificationForm.patchValue({
          emailEnabled: prefs.methods.includes('email'),
          smsEnabled: prefs.methods.includes('sms'),
          quietHoursEnabled: prefs.quietHoursEnabled,
          quietHoursStart: prefs.quietHoursStart || '22:00',
          quietHoursEnd: prefs.quietHoursEnd || '08:00',
          timezone: prefs.timezone,
        });
      }
    }
  }

  async saveProfile() {
    this.savingProfile.set(true);
    this.profileSaved.set(false);
    
    try {
      await this.authService.updateProfile({
        displayName: this.profileForm.get('displayName')?.value,
        phoneNumber: this.profileForm.get('phoneNumber')?.value,
      });
      this.profileSaved.set(true);
      setTimeout(() => this.profileSaved.set(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      this.savingProfile.set(false);
    }
  }

  async saveNotifications() {
    this.savingNotifications.set(true);
    this.notificationsSaved.set(false);
    
    const methods: string[] = [];
    if (this.notificationForm.get('emailEnabled')?.value) methods.push('email');
    if (this.notificationForm.get('smsEnabled')?.value) methods.push('sms');
    
    try {
      await this.authService.updateProfile({
        notificationPreferences: {
          methods: methods as any,
          quietHoursEnabled: this.notificationForm.get('quietHoursEnabled')?.value,
          quietHoursStart: this.notificationForm.get('quietHoursStart')?.value,
          quietHoursEnd: this.notificationForm.get('quietHoursEnd')?.value,
          timezone: this.notificationForm.get('timezone')?.value,
        },
      });
      this.notificationsSaved.set(true);
      setTimeout(() => this.notificationsSaved.set(false), 3000);
    } catch (err) {
      console.error('Error saving notifications:', err);
    } finally {
      this.savingNotifications.set(false);
    }
  }

  async openBillingPortal() {
    await this.subscriptionService.redirectToPortal();
  }

  deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      // TODO: Implement account deletion
      alert('Please contact support to delete your account.');
    }
  }
}
