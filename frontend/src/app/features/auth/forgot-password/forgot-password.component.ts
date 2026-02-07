import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Reset Password</h1>
        <p class="auth-subtitle">Enter your email and we'll send you a reset link</p>

        @if (error()) {
          <div class="error-message">{{ error() }}</div>
        }

        @if (success()) {
          <div class="success-message">
            Password reset email sent! Check your inbox for further instructions.
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                formControlName="email"
                placeholder="you@example.com"
                [class.error]="form.get('email')?.touched && form.get('email')?.invalid"
              />
              @if (form.get('email')?.touched && form.get('email')?.errors?.['required']) {
                <span class="field-error">Email is required</span>
              }
              @if (form.get('email')?.touched && form.get('email')?.errors?.['email']) {
                <span class="field-error">Please enter a valid email</span>
              }
            </div>

            <button type="submit" class="btn btn-primary" [disabled]="loading() || form.invalid">
              @if (loading()) {
                Sending...
              } @else {
                Send Reset Link
              }
            </button>
          </form>
        }

        <p class="auth-footer">
          Remember your password? <a routerLink="/auth/login">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: #f8f9fa;
    }

    .auth-card {
      background: white;
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 420px;
    }

    h1 {
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
      text-align: center;
      color: #1a1a1a;
    }

    .auth-subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 2rem;
    }

    .error-message {
      background: #FFEBEE;
      color: #C62828;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }

    .success-message {
      background: #E8F5E9;
      color: #2E7D32;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #333;
    }

    input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    input:focus {
      outline: none;
      border-color: #2E7D32;
    }

    input.error {
      border-color: #C62828;
    }

    .field-error {
      color: #C62828;
      font-size: 0.75rem;
      margin-top: 0.25rem;
      display: block;
    }

    .btn {
      width: 100%;
      padding: 0.875rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #2E7D32;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1B5E20;
    }

    .btn-primary:disabled {
      background: #A5D6A7;
      cursor: not-allowed;
    }

    .auth-footer {
      text-align: center;
      margin-top: 1.5rem;
      color: #666;
    }

    .auth-footer a {
      color: #2E7D32;
      text-decoration: none;
      font-weight: 500;
    }

    .auth-footer a:hover {
      text-decoration: underline;
    }
  `],
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const { email } = this.form.value;
      await this.authService.sendPasswordReset(email);
      this.success.set(true);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }
}
