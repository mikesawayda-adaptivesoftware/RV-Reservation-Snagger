# RV Reservation Snagger

A campsite availability alert system that monitors national and state park reservation websites and notifies users when campsites become available.

## Features

- **Multi-platform monitoring**: Recreation.gov, ReserveAmerica, ReserveCalifornia
- **Flexible alerts**: Set date ranges, site types, and campground preferences
- **Instant notifications**: Email and SMS alerts when sites become available
- **Subscription tiers**: Different check frequencies (10/30/60 minutes)
- **User dashboard**: Manage alerts, view matches, track history

## Tech Stack

### Frontend
- Angular 17+ (standalone components)
- Firebase Authentication
- Cloud Firestore

### Backend
- Node.js with Express
- TypeScript
- Firebase Admin SDK
- Puppeteer for web scraping
- Node-cron for job scheduling

### External Services
- **Firebase**: Authentication & Firestore database
- **Stripe**: Subscription payments
- **SendGrid**: Email notifications
- **Twilio**: SMS notifications

## Project Structure

```
RV-Reservation-Snagger/
├── frontend/                 # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/        # Guards, interceptors, services
│   │   │   ├── shared/      # Shared components
│   │   │   └── features/    # Feature modules
│   │   └── environments/    # Environment configs
│   └── package.json
│
├── backend/                  # Node.js server
│   ├── src/
│   │   ├── api/             # Express routes
│   │   ├── scrapers/        # Park-specific scrapers
│   │   ├── scheduler/       # Job scheduling
│   │   ├── notifications/   # Email/SMS services
│   │   ├── services/        # Business logic
│   │   └── config/          # Configuration
│   └── package.json
│
└── shared/                   # Shared TypeScript types
    └── types/
```

## Setup

### Prerequisites
- Node.js 18+
- Firebase project with Authentication and Firestore enabled
- Recreation.gov RIDB API key (recommended for park search)
- Stripe account (optional, only for subscription checkout/billing flows)
- SendGrid account (optional, only for live email delivery)
- Twilio account (optional, only for live SMS delivery)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment example file:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with:
   - Firebase Admin SDK credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`)
   - Recreation.gov RIDB API key (`RECREATION_GOV_API_KEY`) if you want park search to return real results
   - Stripe API keys if you want to test subscription checkout or billing
   - SendGrid API key if you want to send real emails
   - Twilio credentials if you want to send real SMS messages

5. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Verify `src/environments/environment.ts` and `src/environments/environment.prod.ts` point to the Firebase project you want to use.

   The repo already includes a Firebase web config. You only need to change it if you are using a different Firebase project.

4. Start the development server:
   ```bash
   npm start
   ```

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication with:
   - Email/Password
   - Google
   - Facebook (required if you want the Facebook sign-in button to work)
3. Enable Cloud Firestore
4. Generate a service account key for the backend
5. Set up Firestore security rules if you plan to access Firestore directly from the frontend

   The current backend uses the Firebase Admin SDK, which bypasses Firestore security rules. The current frontend initializes Firestore, but most app data access still goes through the backend API.

### Firestore Security Rules

These rules are a good starting point if you later move more Firestore access into the frontend. They are not required for backend Admin SDK access.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /alerts/{alertId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
    match /subscriptions/{subId} {
      allow read: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    match /alertMatches/{matchId} {
      allow read: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

### Stripe Setup

1. Create products and prices in Stripe Dashboard for each tier:
   - Basic (monthly/yearly)
   - Standard (monthly/yearly)
   - Premium (monthly/yearly)

2. Update the price IDs in `backend/src/config/pricing.ts`

3. Set up webhook endpoint: `https://your-domain.com/api/webhooks/stripe`

4. Configure webhook events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

## Subscription Tiers

| Tier | Check Frequency | Max Alerts | Price (configurable) |
|------|-----------------|------------|----------------------|
| Free | Manual only | 1 | $0 |
| Basic | Every 60 min | 5 | $4.99/month |
| Standard | Every 30 min | 15 | $9.99/month |
| Premium | Every 10 min | 50 | $19.99/month |

Prices are configurable in `backend/src/config/pricing.ts`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/profile` | Create/sync user profile |
| GET | `/api/auth/profile` | Get user profile |
| PATCH | `/api/auth/profile` | Update user profile |
| GET | `/api/subscription/pricing` | Get pricing tiers |
| POST | `/api/subscription/checkout` | Create Stripe checkout |
| POST | `/api/subscription/portal` | Create billing portal session |
| GET | `/api/alerts` | List user's alerts |
| POST | `/api/alerts` | Create new alert |
| GET | `/api/alerts/:id` | Get alert details |
| PATCH | `/api/alerts/:id` | Update alert |
| DELETE | `/api/alerts/:id` | Delete alert |
| GET | `/api/alerts/:id/matches` | Get alert matches |
| GET | `/api/parks/search` | Search parks |

## Development

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Building for Production

```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build
```

## Deployment

### Backend
Deploy to any Node.js hosting platform:
- Google Cloud Run
- AWS ECS/EC2
- DigitalOcean App Platform
- Heroku

### Frontend
Deploy to any static hosting:
- Firebase Hosting
- Vercel
- Netlify
- AWS S3/CloudFront

## Future Enhancements

- [ ] Additional park systems (state parks, private campgrounds)
- [ ] One-click reservation (auto-book when available)
- [ ] Mobile app with push notifications
- [ ] Historical availability data and trends
- [ ] Site-specific preferences (hookups, waterfront, shade)
- [ ] Group trip coordination

## License

MIT
