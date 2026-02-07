import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  User,
  onAuthStateChanged,
} from '@angular/fire/auth';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  subscriptionTier: string;
  notificationPreferences: {
    methods: string[];
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    timezone: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private http = inject(HttpClient);
  private router = inject(Router);

  // Signals for reactive state
  private currentUserSignal = signal<User | null>(null);
  private userProfileSignal = signal<UserProfile | null>(null);
  private loadingSignal = signal<boolean>(true);

  // Public computed signals
  currentUser = computed(() => this.currentUserSignal());
  userProfile = computed(() => this.userProfileSignal());
  isLoading = computed(() => this.loadingSignal());
  isAuthenticated = computed(() => this.currentUserSignal() !== null);

  constructor() {
    // Listen to auth state changes
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUserSignal.set(user);
      
      if (user) {
        await this.syncUserProfile();
      } else {
        this.userProfileSignal.set(null);
      }
      
      this.loadingSignal.set(false);
    });
  }

  // Email/Password Sign In
  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      await this.syncUserProfile();
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Email/Password Sign Up
  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<void> {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Send verification email
      if (credential.user) {
        await sendEmailVerification(credential.user);
      }
      
      await this.syncUserProfile();
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Google Sign In
  async signInWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      await this.syncUserProfile();
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Facebook Sign In
  async signInWithFacebook(): Promise<void> {
    try {
      const provider = new FacebookAuthProvider();
      await signInWithPopup(this.auth, provider);
      await this.syncUserProfile();
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Sign Out
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      this.userProfileSignal.set(null);
      this.router.navigate(['/']);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Password Reset
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Sync user profile with backend
  private async syncUserProfile(): Promise<void> {
    try {
      const response = await this.http
        .post<{ success: boolean; data: UserProfile }>(`${environment.apiUrl}/auth/profile`, {})
        .toPromise();
      
      if (response?.success && response.data) {
        this.userProfileSignal.set(response.data);
      }
    } catch (error) {
      console.error('Error syncing user profile:', error);
    }
  }

  // Update user profile
  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    try {
      const response = await this.http
        .patch<{ success: boolean; data: UserProfile }>(`${environment.apiUrl}/auth/profile`, updates)
        .toPromise();
      
      if (response?.success && response.data) {
        this.userProfileSignal.set(response.data);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // Handle Firebase auth errors
  private handleAuthError(error: any): Error {
    let message = 'An error occurred during authentication.';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        message = 'This email is already registered. Please sign in instead.';
        break;
      case 'auth/invalid-email':
        message = 'Please enter a valid email address.';
        break;
      case 'auth/operation-not-allowed':
        message = 'This sign-in method is not enabled.';
        break;
      case 'auth/weak-password':
        message = 'Please choose a stronger password (at least 6 characters).';
        break;
      case 'auth/user-disabled':
        message = 'This account has been disabled.';
        break;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        message = 'Invalid email or password.';
        break;
      case 'auth/popup-closed-by-user':
        message = 'Sign-in was cancelled.';
        break;
      case 'auth/network-request-failed':
        message = 'Network error. Please check your connection.';
        break;
      default:
        message = error.message || message;
    }
    
    return new Error(message);
  }
}
