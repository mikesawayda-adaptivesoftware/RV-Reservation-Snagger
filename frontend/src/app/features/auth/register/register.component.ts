import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Create Account</h1>
        <p class="auth-subtitle">Start getting campsite alerts today</p>

        @if (error()) {
          <div class="error-message">{{ error() }}</div>
        }

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

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              formControlName="password"
              placeholder="At least 6 characters"
              [class.error]="form.get('password')?.touched && form.get('password')?.invalid"
            />
            @if (form.get('password')?.touched && form.get('password')?.errors?.['required']) {
              <span class="field-error">Password is required</span>
            }
            @if (form.get('password')?.touched && form.get('password')?.errors?.['minlength']) {
              <span class="field-error">Password must be at least 6 characters</span>
            }
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              formControlName="confirmPassword"
              placeholder="Repeat your password"
              [class.error]="form.get('confirmPassword')?.touched && form.get('confirmPassword')?.invalid"
            />
            @if (form.get('confirmPassword')?.touched && form.get('confirmPassword')?.errors?.['required']) {
              <span class="field-error">Please confirm your password</span>
            }
            @if (form.get('confirmPassword')?.touched && form.errors?.['passwordMismatch']) {
              <span class="field-error">Passwords do not match</span>
            }
          </div>

          <button type="submit" class="btn btn-primary" [disabled]="loading() || form.invalid">
            @if (loading()) {
              Creating account...
            } @else {
              Create Account
            }
          </button>
        </form>

        <div class="divider">
          <span>or continue with</span>
        </div>

        <div class="social-buttons">
          <button type="button" class="btn btn-social" (click)="signInWithGoogle()" [disabled]="loading()">
            <span class="social-icon">G</span>
            Google
          </button>
          <button type="button" class="btn btn-social" (click)="signInWithFacebook()" [disabled]="loading()">
            <span class="social-icon">f</span>
            Facebook
          </button>
        </div>

        <p class="auth-footer">
          Already have an account? <a routerLink="/auth/login">Sign in</a>
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

    .form-group {
      margin-bottom: 1.25rem;
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
      margin-top: 0.5rem;
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

    .divider {
      display: flex;
      align-items: center;
      margin: 1.5rem 0;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid #e0e0e0;
    }

    .divider span {
      padding: 0 1rem;
      color: #999;
      font-size: 0.875rem;
    }

    .social-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .btn-social {
      background: white;
      border: 1px solid #ddd;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn-social:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .social-icon {
      font-weight: bold;
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
export class RegisterComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  loading = signal(false);
  error = signal<string | null>(null);

  form: FormGroup = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator }
  );

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password?.value !== confirmPassword?.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  async onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.form.value;
      await this.authService.signUpWithEmail(email, password);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithGoogle() {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.authService.signInWithGoogle();
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithFacebook() {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.authService.signInWithFacebook();
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }
}
