import { Router, Request, Response } from 'express';
import { verifyToken } from './auth';
import { ApiResponse, ParkSearchResult, CampgroundSearchResult, ParkSystem } from '../../shared/types';
import { logger } from '../services/logger';

const router = Router();

import dotenv from 'dotenv';
dotenv.config();

const RECREATION_GOV_API_KEY = process.env.RECREATION_GOV_API_KEY || '';
const RIDB_BASE_URL = 'https://ridb.recreation.gov/api/v1';

// Log API key status on load (first 8 chars only for security)
console.log(`RIDB API Key loaded: ${RECREATION_GOV_API_KEY ? RECREATION_GOV_API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);

// Apply auth middleware to all routes
router.use(verifyToken);

// Search parks using Recreation.gov RIDB API
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, system, state } = req.query;
    const query = (q as string || '').trim();

    // If no query or query too short, return empty
    if (!query || query.length < 2) {
      const response: ApiResponse<ParkSearchResult[]> = {
        success: true,
        data: [],
      };
      res.json(response);
      return;
    }

    // For recreation_gov system, use the real API
    if (!system || system === 'recreation_gov') {
      const results = await searchRecreationGov(query, state as string);
      const response: ApiResponse<ParkSearchResult[]> = {
        success: true,
        data: results,
      };
      res.json(response);
      return;
    }

    // For other systems, return empty for now (would need separate implementations)
    const response: ApiResponse<ParkSearchResult[]> = {
      success: true,
      data: [],
    };
    res.json(response);
  } catch (error) {
    logger.error('Error searching parks:', error);
    res.status(500).json({ success: false, error: 'Failed to search parks' });
  }
});

// Search Recreation.gov using RIDB API
async function searchRecreationGov(query: string, state?: string): Promise<ParkSearchResult[]> {
  try {
    const params = new URLSearchParams({
      query: query,
      limit: '20',
      offset: '0',
      activity: 'CAMPING', // Only return places with camping
    });

    if (state) {
      params.append('state', state.toUpperCase());
    }

    const url = `${RIDB_BASE_URL}/recareas?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': RECREATION_GOV_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      logger.error(`RIDB API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    // Transform RIDB response to our format
    const results: ParkSearchResult[] = (data.RECDATA || []).map((rec: any) => ({
      id: rec.RecAreaID.toString(),
      name: rec.RecAreaName,
      parkSystem: 'recreation_gov' as ParkSystem,
      state: extractState(rec.RECAREAADDRESS),
      description: rec.RecAreaDescription ? 
        stripHtml(rec.RecAreaDescription).substring(0, 200) + '...' : null,
      imageUrl: rec.MEDIA?.[0]?.URL || null,
      campgroundCount: rec.FACILITY?.length || 0,
    }));

    return results;
  } catch (error) {
    logger.error('Error calling RIDB API:', error);
    return [];
  }
}

// Get campgrounds (facilities) for a rec area
router.get('/:system/:parkId/campgrounds', async (req: Request, res: Response) => {
  try {
    const { system, parkId } = req.params;

    if (system === 'recreation_gov') {
      const campgrounds = await getCampgroundsFromRecreationGov(parkId);
      const response: ApiResponse<CampgroundSearchResult[]> = {
        success: true,
        data: campgrounds,
      };
      res.json(response);
      return;
    }

    // For other systems, return empty
    const response: ApiResponse<CampgroundSearchResult[]> = {
      success: true,
      data: [],
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching campgrounds:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch campgrounds' });
  }
});

// Get campgrounds from Recreation.gov
async function getCampgroundsFromRecreationGov(recAreaId: string): Promise<CampgroundSearchResult[]> {
  try {
    const url = `${RIDB_BASE_URL}/recareas/${recAreaId}/facilities?limit=50&offset=0`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': RECREATION_GOV_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      logger.error(`RIDB API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    logger.info(`RIDB facilities response for recArea ${recAreaId}: ${(data.RECDATA || []).length} facilities found`);
    
    // Log facility types to help debug
    (data.RECDATA || []).forEach((fac: any) => {
      logger.debug(`Facility: ${fac.FacilityName} - Type: ${fac.FacilityTypeDescription} - Reservable: ${fac.Reservable} - URL: ${fac.FacilityReservationURL || 'none'}`);
    });
    
    // Filter to camping facilities that are reservable through Recreation.gov
    const campgrounds: CampgroundSearchResult[] = (data.RECDATA || [])
      .filter((fac: any) => {
        const typeDesc = (fac.FacilityTypeDescription || '').toLowerCase();
        const name = (fac.FacilityName || '').toLowerCase();
        const reservationUrl = (fac.FacilityReservationURL || '').toLowerCase();
        
        // Must be a campground type
        const isCampground = typeDesc.includes('campground') || 
               typeDesc.includes('camping') ||
               name.includes('campground') ||
               name.includes('camp');
        
        if (!isCampground) return false;
        
        // Must be reservable through Recreation.gov (not external)
        // Recreation.gov facilities have a URL like /camping/campgrounds/XXXXX
        // External facilities may have external URLs or no URL
        const isReservableOnRecGov = fac.Reservable === true && 
          (reservationUrl === '' || 
           reservationUrl.includes('recreation.gov/camping/campgrounds'));
        
        // Also filter out POI-style IDs (they tend to be 8+ digits starting with 10)
        const facilityId = fac.FacilityID?.toString() || '';
        const isPOI = facilityId.startsWith('10') && facilityId.length >= 8;
        
        if (isPOI) {
          logger.debug(`Filtering out POI facility: ${fac.FacilityName} (ID: ${facilityId})`);
          return false;
        }
        
        // If we can't determine reservability, include it but log a warning
        if (fac.Reservable === undefined) {
          logger.debug(`Unknown reservability for: ${fac.FacilityName}`);
          return true; // Include for now
        }
        
        return isReservableOnRecGov;
      })
      .map((fac: any) => ({
        id: fac.FacilityID.toString(),
        parkId: recAreaId,
        name: fac.FacilityName,
        parkSystem: 'recreation_gov' as ParkSystem,
        siteTypes: determineSiteTypes(fac),
        totalSites: fac.CAMPSITE?.length || 0,
        description: fac.FacilityDescription ? 
          stripHtml(fac.FacilityDescription).substring(0, 200) : null,
        amenities: extractAmenities(fac),
      }));

    logger.info(`Filtered to ${campgrounds.length} campgrounds for recArea ${recAreaId}`);
    
    return campgrounds;
  } catch (error) {
    logger.error('Error fetching campgrounds from RIDB:', error);
    return [];
  }
}

// Get park details
router.get('/:system/:id', async (req: Request, res: Response) => {
  try {
    const { system, id } = req.params;

    if (system === 'recreation_gov') {
      const park = await getRecAreaDetails(id);
      if (!park) {
        res.status(404).json({ success: false, error: 'Park not found' });
        return;
      }
      const response: ApiResponse<ParkSearchResult> = {
        success: true,
        data: park,
      };
      res.json(response);
      return;
    }

    res.status(404).json({ success: false, error: 'Park not found' });
  } catch (error) {
    logger.error('Error fetching park:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch park' });
  }
});

// Get rec area details from RIDB
async function getRecAreaDetails(recAreaId: string): Promise<ParkSearchResult | null> {
  try {
    const url = `${RIDB_BASE_URL}/recareas/${recAreaId}`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': RECREATION_GOV_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const rec = await response.json();
    
    return {
      id: rec.RecAreaID.toString(),
      name: rec.RecAreaName,
      parkSystem: 'recreation_gov',
      state: extractState(rec.RECAREAADDRESS),
      description: rec.RecAreaDescription ? stripHtml(rec.RecAreaDescription) : null,
      imageUrl: rec.MEDIA?.[0]?.URL || null,
      campgroundCount: rec.FACILITY?.length || 0,
    };
  } catch (error) {
    logger.error('Error fetching rec area details:', error);
    return null;
  }
}

// Get campground details
router.get('/:system/:parkId/campgrounds/:campgroundId', async (req: Request, res: Response) => {
  try {
    const { system, parkId, campgroundId } = req.params;

    if (system === 'recreation_gov') {
      const campground = await getFacilityDetails(campgroundId, parkId);
      if (!campground) {
        res.status(404).json({ success: false, error: 'Campground not found' });
        return;
      }
      const response: ApiResponse<CampgroundSearchResult> = {
        success: true,
        data: campground,
      };
      res.json(response);
      return;
    }

    res.status(404).json({ success: false, error: 'Campground not found' });
  } catch (error) {
    logger.error('Error fetching campground:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch campground' });
  }
});

// Get facility details
async function getFacilityDetails(facilityId: string, parkId: string): Promise<CampgroundSearchResult | null> {
  try {
    const url = `${RIDB_BASE_URL}/facilities/${facilityId}`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': RECREATION_GOV_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const fac = await response.json();
    
    return {
      id: fac.FacilityID.toString(),
      parkId: parkId,
      name: fac.FacilityName,
      parkSystem: 'recreation_gov',
      siteTypes: determineSiteTypes(fac),
      totalSites: fac.CAMPSITE?.length || 0,
      description: fac.FacilityDescription ? stripHtml(fac.FacilityDescription) : null,
      amenities: extractAmenities(fac),
    };
  } catch (error) {
    logger.error('Error fetching facility details:', error);
    return null;
  }
}

// Helper: Extract state from address array
function extractState(addresses: any[]): string {
  if (!addresses || addresses.length === 0) return '';
  const addr = addresses.find((a: any) => a.AddressStateCode) || addresses[0];
  return addr?.AddressStateCode || '';
}

// Helper: Strip HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// Helper: Determine site types from facility data
function determineSiteTypes(facility: any): ('tent' | 'rv' | 'cabin' | 'group')[] {
  const types: ('tent' | 'rv' | 'cabin' | 'group')[] = [];
  const name = (facility.FacilityName || '').toLowerCase();
  const desc = (facility.FacilityDescription || '').toLowerCase();
  const combined = name + ' ' + desc;

  // Check for different site types
  if (combined.includes('tent') || combined.includes('campground')) {
    types.push('tent');
  }
  if (combined.includes('rv') || combined.includes('trailer') || combined.includes('hookup')) {
    types.push('rv');
  }
  if (combined.includes('cabin') || combined.includes('yurt') || combined.includes('lodge')) {
    types.push('cabin');
  }
  if (combined.includes('group')) {
    types.push('group');
  }

  // Default to tent if nothing detected
  if (types.length === 0) {
    types.push('tent');
  }

  return types;
}

// Helper: Extract amenities
function extractAmenities(facility: any): string[] {
  const amenities: string[] = [];
  
  if (facility.FACILITYATTRIBUTE) {
    facility.FACILITYATTRIBUTE.forEach((attr: any) => {
      if (attr.AttributeName && attr.AttributeValue) {
        amenities.push(`${attr.AttributeName}: ${attr.AttributeValue}`);
      }
    });
  }

  return amenities.slice(0, 10); // Limit to 10 amenities
}

export default router;
