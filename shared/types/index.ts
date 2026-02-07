// Park Systems
export type ParkSystem = 'recreation_gov' | 'reserve_america' | 'reserve_california';

// Site Types
export type SiteType = 'tent' | 'rv' | 'cabin' | 'group';

// Subscription Tiers
export type SubscriptionTier = 'free' | 'basic' | 'standard' | 'premium';

// Notification Methods
export type NotificationMethod = 'email' | 'sms' | 'push';

// User Profile
export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  notificationPreferences: NotificationPreferences;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  methods: NotificationMethod[];
  quietHoursEnabled: boolean;
  quietHoursStart: string | null; // HH:mm format
  quietHoursEnd: string | null;   // HH:mm format
  timezone: string;
}

// Campsite Alert
export interface CampsiteAlert {
  id: string;
  userId: string;
  name: string;
  parkSystem: ParkSystem;
  parkId: string;
  parkName: string;
  campgroundId: string | null;
  campgroundName: string | null;
  siteTypes: SiteType[];
  dateRangeStart: Date;
  dateRangeEnd: Date;
  flexibleDates: boolean;
  minNights: number;
  maxNights: number;
  specificSiteIds: string[] | null; // For specific site preferences
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastChecked: Date | null;
  matchesFound: number;
}

// Alert Match (when availability is found)
export interface AlertMatch {
  id: string;
  alertId: string;
  userId: string;
  parkSystem: ParkSystem;
  parkName: string;
  campgroundName: string;
  siteName: string;
  siteId: string;
  siteType: SiteType;
  availableDates: DateRange[];
  reservationUrl: string;
  foundAt: Date;
  notifiedAt: Date | null;
  notificationMethods: NotificationMethod[];
  isExpired: boolean;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Subscription
export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 
  | 'active' 
  | 'canceled' 
  | 'incomplete' 
  | 'incomplete_expired' 
  | 'past_due' 
  | 'trialing' 
  | 'unpaid';

// Pricing Tier Configuration
export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  scrapeIntervalMinutes: number;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  maxAlerts: number;
  features: string[];
}

// Notification Record
export interface NotificationRecord {
  id: string;
  userId: string;
  alertId: string;
  matchId: string;
  method: NotificationMethod;
  status: 'pending' | 'sent' | 'failed';
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
}

// Scrape Job
export interface ScrapeJob {
  id: string;
  alertId: string;
  userId: string;
  parkSystem: ParkSystem;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  matchesFound: number;
  createdAt: Date;
}

// Park/Campground Search Results
export interface ParkSearchResult {
  id: string;
  name: string;
  parkSystem: ParkSystem;
  state: string;
  description: string | null;
  imageUrl: string | null;
  campgroundCount: number;
}

export interface CampgroundSearchResult {
  id: string;
  parkId: string;
  name: string;
  parkSystem: ParkSystem;
  siteTypes: SiteType[];
  totalSites: number;
  description: string | null;
  amenities: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
