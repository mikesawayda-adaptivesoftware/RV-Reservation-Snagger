# Alert Creation Enhancement Plan

## Goal

Enhance the alert creation experience so users can:

- Select a state and discover campgrounds more easily
- Create alerts across multiple campgrounds
- Filter alerts by amenities and site preferences
- Choose between specific trip dates and "any available dates"
- Receive more useful match information, including continuous available nights

## Current State

The current alert model and UI support:

- One selected park
- Optional one selected campground
- Site type filtering
- Required start and end dates
- Minimum and maximum nights
- Optional specific site IDs

Important current backend constraint:

- Recreation.gov availability checks are currently performed per campground via the monthly campground availability endpoint
- Recreation.gov alerts currently require a specific `campgroundId`
- The shared alert model only supports a single `campgroundId` / `campgroundName`

## Key Constraints

### Recreation.gov API shape

The current integration uses:

- RIDB `recareas` for park search
- RIDB `recareas/{id}/facilities` for campground discovery
- RIDB `facilities/{id}` for facility metadata and amenities
- Recreation.gov campground availability endpoint for site availability

This means:

- Park and campground discovery are feasible today
- Campground-level amenities are available today
- Availability is campground-based, so checking many campgrounds increases request volume quickly
- Site-level amenity support is not yet proven to be consistently available in the current integration

### Data model limitations

Today the alert model is still optimized for a single campground and a required date range. That makes the following impossible or awkward without schema changes:

- Multi-campground alerts
- Statewide alerts
- Radius-based alerts
- Explicit "any dates" behavior
- Structured amenity filtering

### Operational limits

Multi-campground or statewide alerts can multiply scrape volume quickly because each selected campground may require one or more monthly availability requests per check cycle.

This makes request caps, caching, and subscription-tier guardrails important.

## Product Strategy

The recommended approach is to deliver this in phases rather than trying to ship all features at once.

## Phase 1: Better Campground Selection

### User-facing goals

- Let the user pick a state first
- Show campgrounds in a searchable, filterable selector
- Allow selecting multiple campgrounds
- Support bulk selection of visible or filtered campgrounds
- Show the number of selected campgrounds clearly

### Scope recommendation

For the first version:

- Support multi-campground alerts within a selected park or state-driven discovery flow
- Do not ship unlimited statewide live alerts yet
- Treat statewide selection as a filtering and bulk-selection tool rather than an unbounded live-monitoring scope

### Backend changes

- Replace single `campgroundId` / `campgroundName` with `campgroundIds[]` / `campgroundNames[]`
- Keep backward compatibility for existing alerts during migration
- Update validation in alert create and update APIs
- Update scraper execution to iterate over selected campgrounds
- Enforce per-plan campground-count limits

### Frontend changes

- Add a state selector
- Add a searchable multi-select campground control
- Add chips or tags for selected campgrounds
- Add "select all filtered" and "clear all"
- Show alert coverage summary before submit

### Suggested plan limits

Example limits to keep scrape volume manageable:

- Free: 1 campground
- Basic: 3 campgrounds
- Standard: 10 campgrounds
- Premium: 25 campgrounds

These are product defaults and can be adjusted later based on load testing.

## Phase 2: Date Modes

### Problem

The current UI has a `flexibleDates` checkbox, but the backend still filters results against the selected date range. It does not truly support an "any dates" alert mode.

### Recommendation

Introduce explicit date modes:

- `specific_range`
- `any_dates`

### Expected behavior

#### `specific_range`

- User supplies start and end dates
- Alert only matches availability overlapping that range
- `minNights` and `maxNights` still apply

#### `any_dates`

- User does not need to enter a date range
- Alert matches any future availability for selected campgrounds and site filters
- `minNights` and `maxNights` still apply
- Matches should display:
  - available date ranges
  - continuous nights available
  - site and campground details

### Backend changes

- Add `dateMode`
- Make `dateRangeStart` / `dateRangeEnd` optional for `any_dates`
- Update matching logic in scraper filtering
- Improve match records to store derived values like continuous-night counts if helpful

### Frontend changes

- Replace the current `flexibleDates` checkbox with a clear date mode selector
- Dynamically show or hide date inputs based on mode
- Update form validation and review summary

## Phase 3: Amenities and Site Preferences

### Goal

Allow users to say things like:

- RV site with water and electric
- Pull-through site
- Large site
- Pool at the campground
- Campfire or fire ring

### Recommendation

Split amenities into two categories:

#### Campground amenities

Examples:

- pool
- showers
- dump station
- potable water
- playground

These are more feasible today because the app already fetches campground facility details and maps amenities from facility attributes.

#### Site-level requirements

Examples:

- electric hookup
- water hookup
- sewer hookup
- pull-through
- max vehicle length
- ADA accessibility
- waterfront
- fire ring

These should be treated as an advanced phase because the current integration does not yet have a reliable, normalized site-level amenity dataset.

### Backend changes

- Add structured alert fields like `requiredAmenities[]`
- Build an amenity normalization layer:
  - raw provider attributes -> canonical amenity keys
- Extend available-site matching to enforce hard requirements

### Frontend changes

- Add grouped amenity filters
- Clearly label filters as "required"
- Only expose filters the backend can actually enforce reliably

### Risk

Recreation.gov attribute naming may be inconsistent across facilities and providers. The first implementation should focus on amenity filters that are reliable enough to avoid false expectations.

## Phase 4: Broader Geography

### Statewide alerts

This is useful, but expensive if implemented as unrestricted live monitoring.

Recommended approach:

- First support state-based discovery and bulk campground selection
- Delay true statewide live alerts until request volume and caching strategy are understood

### Radius from address

This is a good long-term feature, but not an MVP item.

It requires:

- campground geolocation data
- geocoding for user-entered addresses
- distance calculations
- probably a cached campground index rather than purely live API calls

Recommendation:

- Defer until after multi-campground alerts and date-mode improvements are stable

## Proposed Data Model Direction

Suggested future alert shape:

```ts
type AlertDateMode = 'specific_range' | 'any_dates';
type AlertScopeType = 'park' | 'state' | 'radius';

interface CampsiteAlertV2 {
  parkSystem: ParkSystem;
  scopeType: AlertScopeType;

  parkId?: string | null;
  parkName?: string | null;
  stateCode?: string | null;

  originAddress?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  radiusMiles?: number | null;

  campgroundIds: string[];
  campgroundNames: string[];

  siteTypes: SiteType[];
  specificSiteIds: string[] | null;

  dateMode: AlertDateMode;
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;

  minNights: number;
  maxNights: number;

  requiredAmenities: string[];
}
```

Migration recommendation:

- Keep the current alert format working during a transition
- Add compatibility mapping from legacy single-campground alerts to the new structure

## UX Proposal

Recommended alert-creation flow:

1. Choose park system
2. Choose scope
3. Choose state
4. Search and select campgrounds
5. Choose site types
6. Choose required amenities
7. Choose date mode
8. Choose stay length
9. Name alert
10. Review summary and submit

Important UX additions:

- Show selected campground count
- Show whether the alert uses a specific date range or any dates
- Show which filters are hard requirements
- Show estimated coverage and, if helpful, estimated scan cost

## Technical Implementation Plan

### Backend

- Extend shared alert types and DTOs
- Update `/api/alerts` create and update routes
- Add migration-safe support for multi-campground alerts
- Update Recreation.gov scraper to iterate selected campgrounds
- Add date-mode-aware matching logic
- Add amenity normalization and filtering
- Add plan-based guardrails for selected campground count
- Add caching where needed for campground metadata

### Frontend

- Refactor `alert-create.component.ts` into smaller sections or child components
- Add state selection UI
- Add searchable multi-select campground picker
- Add amenity filters
- Add explicit date mode selector
- Update alert detail, edit, and list views for new fields

### Data and infrastructure

- Cache park and campground search results where helpful
- Cache facility metadata and amenity lookups where helpful
- Consider background metadata refresh if live API usage becomes expensive

## Risks

- Site-level amenity filtering may not be consistently supported by current provider data
- Multi-campground alerts can significantly increase upstream API traffic
- Any-date alerts may generate more notifications unless deduping and throttling are improved
- Radius search is not practical without a geographic metadata layer

## Recommended Delivery Order

1. Multi-campground support with state-based discovery
2. Explicit date modes: `specific_range` and `any_dates`
3. Campground-level amenity filters
4. Site-level amenity filters where data quality supports them
5. Statewide live alerts
6. Radius-from-address alerts

## Open Decisions

Before implementation, these product decisions should be finalized:

1. Should "all campgrounds in a state" be a true live alert target, or only a bulk-selection shortcut up to a plan-based cap?
2. Should `any_dates` alerts still require `minNights` / `maxNights` filtering?
3. Should amenity filters be exposed only when they are guaranteed, or can some be labeled best-effort?
4. What campground-count caps should apply at each subscription tier?

## Recommended Next Step

Create a technical implementation spec that breaks this plan into:

- schema changes
- API contract changes
- scraper changes
- frontend component changes
- migration strategy
- rollout sequence
