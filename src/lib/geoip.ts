import { prisma } from './prisma';

export interface LocationData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
}

export class GeoIPService {
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static locationCache = new Map<string, { data: LocationData; timestamp: number }>();

  /**
   * Get location data for an IP address
   */
  static async getLocationData(ipAddress: string): Promise<LocationData | null> {
    if (!ipAddress || ipAddress === 'unknown' || this.isPrivateIP(ipAddress)) {
      return null;
    }

    // Check cache first
    const cached = this.locationCache.get(ipAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Try multiple free GeoIP services
      let locationData = await this.tryIPAPI(ipAddress);
      
      if (!locationData) {
        locationData = await this.tryIPInfo(ipAddress);
      }

      if (!locationData) {
        locationData = await this.tryFreeGeoIP(ipAddress);
      }

      // Cache the result
      if (locationData) {
        this.locationCache.set(ipAddress, {
          data: locationData,
          timestamp: Date.now(),
        });
      }

      return locationData;
    } catch (error) {
      console.error('GeoIP lookup failed:', error);
      return null;
    }
  }

  /**
   * Try ip-api.com (free, no API key required)
   */
  private static async tryIPAPI(ipAddress: string): Promise<LocationData | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,countryCode,region,city,lat,lon,timezone,isp`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.status !== 'success') {
        return null;
      }

      return {
        country: data.country,
        countryCode: data.countryCode,
        region: data.region,
        city: data.city,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone,
        isp: data.isp,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Try ipinfo.io (free tier available)
   */
  private static async tryIPInfo(ipAddress: string): Promise<LocationData | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://ipinfo.io/${ipAddress}/json`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.bogon) {
        return null;
      }

      const [latitude, longitude] = data.loc ? data.loc.split(',').map(Number) : [null, null];

      return {
        country: data.country,
        countryCode: data.country,
        region: data.region,
        city: data.city,
        latitude,
        longitude,
        timezone: data.timezone,
        isp: data.org,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Try freegeoip.app (backup service)
   */
  private static async tryFreeGeoIP(ipAddress: string): Promise<LocationData | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://freegeoip.app/json/${ipAddress}`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      return {
        country: data.country_name,
        countryCode: data.country_code,
        region: data.region_name,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.time_zone,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if IP address is private/local
   */
  private static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/,
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Get country statistics for analytics
   */
  static async getCountryStatistics(tenantId: string, timeRange?: { start: Date; end: Date }) {
    const whereClause: any = {
      tenantId,
      location: { not: null },
    };

    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    const events = await prisma.emailEvent.findMany({
      where: whereClause,
      select: {
        type: true,
        location: true,
      },
    });

    const countryStats: Record<string, {
      opens: number;
      clicks: number;
      unsubscribes: number;
      totalEvents: number;
    }> = {};

    events.forEach(event => {
      if (event.location && typeof event.location === 'object') {
        const location = event.location as LocationData;
        const country = location.country || 'Unknown';

        if (!countryStats[country]) {
          countryStats[country] = {
            opens: 0,
            clicks: 0,
            unsubscribes: 0,
            totalEvents: 0,
          };
        }

        countryStats[country].totalEvents++;

        switch (event.type) {
          case 'OPENED':
            countryStats[country].opens++;
            break;
          case 'CLICKED':
            countryStats[country].clicks++;
            break;
          case 'UNSUBSCRIBED':
            countryStats[country].unsubscribes++;
            break;
        }
      }
    });

    return Object.entries(countryStats)
      .map(([country, stats]) => ({
        country,
        ...stats,
        engagementRate: stats.totalEvents > 0 ? ((stats.opens + stats.clicks) / stats.totalEvents) * 100 : 0,
      }))
      .sort((a, b) => b.totalEvents - a.totalEvents);
  }

  /**
   * Clear old cache entries
   */
  static clearExpiredCache() {
    const now = Date.now();
    for (const [ip, cached] of this.locationCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.locationCache.delete(ip);
      }
    }
  }
}

// Clean up cache periodically
if (typeof window === 'undefined') {
  setInterval(() => {
    GeoIPService.clearExpiredCache();
  }, 60 * 60 * 1000); // Every hour
}