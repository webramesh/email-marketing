/**
 * GeoIP Service for location detection
 * This is a simplified implementation. In production, you would use a service like:
 * - MaxMind GeoIP2
 * - IP2Location
 * - ipapi.co
 * - ipgeolocation.io
 */

export interface LocationData {
  ip: string;
  country: string;
  countryCode: string;
  region?: string;
  regionCode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  organization?: string;
  asn?: string;
}

class GeoIPService {
  private cache = new Map<string, LocationData>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Lookup location data for an IP address
   */
  async lookup(ipAddress: string): Promise<LocationData | null> {
    try {
      // Skip local/private IPs
      if (this.isPrivateIP(ipAddress)) {
        return {
          ip: ipAddress,
          country: 'Local',
          countryCode: 'LOCAL',
          city: 'Local Network',
        };
      }

      // Check cache first
      const cached = this.cache.get(ipAddress);
      if (cached) {
        return cached;
      }

      // In production, you would call a real GeoIP service here
      // For now, we'll use a mock implementation
      const locationData = await this.mockGeoIPLookup(ipAddress);

      if (locationData) {
        // Cache the result
        this.cache.set(ipAddress, locationData);
        
        // Clean up cache after TTL
        setTimeout(() => {
          this.cache.delete(ipAddress);
        }, this.CACHE_TTL);
      }

      return locationData;
    } catch (error) {
      console.error('GeoIP lookup error:', error);
      return null;
    }
  }

  /**
   * Mock GeoIP lookup for development
   * In production, replace this with actual GeoIP service calls
   */
  private async mockGeoIPLookup(ipAddress: string): Promise<LocationData | null> {
    // This is a mock implementation for development
    // In production, you would make HTTP requests to GeoIP services
    
    const mockData: Record<string, LocationData> = {
      '8.8.8.8': {
        ip: ipAddress,
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'Mountain View',
        latitude: 37.4056,
        longitude: -122.0775,
        timezone: 'America/Los_Angeles',
        isp: 'Google LLC',
        organization: 'Google Public DNS',
        asn: 'AS15169',
      },
      '1.1.1.1': {
        ip: ipAddress,
        country: 'United States',
        countryCode: 'US',
        region: 'California',
        regionCode: 'CA',
        city: 'San Francisco',
        latitude: 37.7749,
        longitude: -122.4194,
        timezone: 'America/Los_Angeles',
        isp: 'Cloudflare, Inc.',
        organization: 'APNIC and Cloudflare DNS Resolver project',
        asn: 'AS13335',
      },
    };

    // Return mock data if available, otherwise generate generic data
    if (mockData[ipAddress]) {
      return mockData[ipAddress];
    }

    // Generate generic location data based on IP
    const hash = this.hashIP(ipAddress);
    const countries = [
      { name: 'United States', code: 'US', cities: ['New York', 'Los Angeles', 'Chicago'] },
      { name: 'United Kingdom', code: 'GB', cities: ['London', 'Manchester', 'Birmingham'] },
      { name: 'Germany', code: 'DE', cities: ['Berlin', 'Munich', 'Hamburg'] },
      { name: 'France', code: 'FR', cities: ['Paris', 'Lyon', 'Marseille'] },
      { name: 'Canada', code: 'CA', cities: ['Toronto', 'Vancouver', 'Montreal'] },
      { name: 'Australia', code: 'AU', cities: ['Sydney', 'Melbourne', 'Brisbane'] },
    ];

    const country = countries[hash % countries.length];
    const city = country.cities[hash % country.cities.length];

    return {
      ip: ipAddress,
      country: country.name,
      countryCode: country.code,
      city,
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
    };
  }

  /**
   * Check if IP address is private/local
   */
  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^127\./, // Loopback
      /^10\./, // Private Class A
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
      /^192\.168\./, // Private Class C
      /^169\.254\./, // Link-local
      /^::1$/, // IPv6 loopback
      /^fc00:/, // IPv6 unique local
      /^fe80:/, // IPv6 link-local
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Simple hash function for IP addresses
   */
  private hashIP(ip: string): number {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const char = ip.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get country name from country code
   */
  getCountryName(countryCode: string): string {
    const countries: Record<string, string> = {
      'US': 'United States',
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'CA': 'Canada',
      'AU': 'Australia',
      'JP': 'Japan',
      'CN': 'China',
      'IN': 'India',
      'BR': 'Brazil',
      'RU': 'Russia',
      'IT': 'Italy',
      'ES': 'Spain',
      'NL': 'Netherlands',
      'SE': 'Sweden',
      'NO': 'Norway',
      'DK': 'Denmark',
      'FI': 'Finland',
      'CH': 'Switzerland',
      'AT': 'Austria',
      'BE': 'Belgium',
      'IE': 'Ireland',
      'PT': 'Portugal',
      'GR': 'Greece',
      'PL': 'Poland',
      'CZ': 'Czech Republic',
      'HU': 'Hungary',
      'SK': 'Slovakia',
      'SI': 'Slovenia',
      'HR': 'Croatia',
      'BG': 'Bulgaria',
      'RO': 'Romania',
      'LT': 'Lithuania',
      'LV': 'Latvia',
      'EE': 'Estonia',
      'LOCAL': 'Local Network',
    };

    return countries[countryCode.toUpperCase()] || countryCode;
  }

  /**
   * Check if country is in a high-risk region
   */
  isHighRiskCountry(countryCode: string): boolean {
    // This is a simplified example. In production, you would maintain
    // a more comprehensive list based on your security requirements
    const highRiskCountries: string[] = [
      // Add country codes that you consider high-risk for your application
      // This is just an example and should be customized based on your needs
    ];

    return highRiskCountries.includes(countryCode.toUpperCase());
  }

  /**
   * Calculate distance between two locations
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const geoip = new GeoIPService();

// Example of how to integrate with a real GeoIP service:
/*
class ProductionGeoIPService extends GeoIPService {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.ipgeolocation.io/ipgeo';
  }

  protected async mockGeoIPLookup(ipAddress: string): Promise<LocationData | null> {
    try {
      const response = await fetch(`${this.apiUrl}?apiKey=${this.apiKey}&ip=${ipAddress}`);
      
      if (!response.ok) {
        throw new Error(`GeoIP API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        ip: data.ip,
        country: data.country_name,
        countryCode: data.country_code2,
        region: data.state_prov,
        regionCode: data.state_code,
        city: data.city,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        timezone: data.time_zone.name,
        isp: data.isp,
        organization: data.organization,
        asn: data.asn,
      };
    } catch (error) {
      console.error('Production GeoIP lookup error:', error);
      return null;
    }
  }
}

// Usage:
// export const geoip = new ProductionGeoIPService(process.env.GEOIP_API_KEY!);
*/