'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';

interface GeographicData {
  country: string;
  opens: number;
  clicks: number;
  unsubscribes: number;
  uniqueSubscribers: number;
  engagementRate: number;
  topCities: Array<{ city: string; count: number }>;
}

export function GeographicAnalytics() {
  const [geoData, setGeoData] = useState<GeographicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  useEffect(() => {
    fetchGeographicData();
  }, []);

  const fetchGeographicData = async () => {
    try {
      const response = await fetch('/api/analytics/geographic');
      if (response.ok) {
        const data = await response.json();
        setGeoData(data);
      }
    } catch (error) {
      console.error('Failed to fetch geographic data:', error);
      // Use mock data for demonstration
      setGeoData([
        {
          country: 'United States',
          opens: 1250,
          clicks: 320,
          unsubscribes: 15,
          uniqueSubscribers: 850,
          engagementRate: 85.2,
          topCities: [
            { city: 'New York', count: 245 },
            { city: 'Los Angeles', count: 180 },
            { city: 'Chicago', count: 125 },
          ],
        },
        {
          country: 'United Kingdom',
          opens: 680,
          clicks: 145,
          unsubscribes: 8,
          uniqueSubscribers: 420,
          engagementRate: 82.1,
          topCities: [
            { city: 'London', count: 320 },
            { city: 'Manchester', count: 85 },
            { city: 'Birmingham', count: 65 },
          ],
        },
        {
          country: 'Canada',
          opens: 450,
          clicks: 95,
          unsubscribes: 5,
          uniqueSubscribers: 280,
          engagementRate: 80.5,
          topCities: [
            { city: 'Toronto', count: 180 },
            { city: 'Vancouver', count: 120 },
            { city: 'Montreal', count: 95 },
          ],
        },
        {
          country: 'Australia',
          opens: 320,
          clicks: 75,
          unsubscribes: 3,
          uniqueSubscribers: 195,
          engagementRate: 78.9,
          topCities: [
            { city: 'Sydney', count: 145 },
            { city: 'Melbourne', count: 110 },
            { city: 'Brisbane', count: 65 },
          ],
        },
        {
          country: 'Germany',
          opens: 280,
          clicks: 55,
          unsubscribes: 4,
          uniqueSubscribers: 165,
          engagementRate: 76.3,
          topCities: [
            { city: 'Berlin', count: 95 },
            { city: 'Munich', count: 75 },
            { city: 'Hamburg', count: 60 },
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const totalEngagement = geoData.reduce((sum, country) => sum + country.opens + country.clicks, 0);
  const maxEngagement = Math.max(...geoData.map(country => country.opens + country.clicks), 1);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-8 bg-gray-200 rounded w-24"></div>
                <div className="flex-1 h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Country List */}
      <div className="lg:col-span-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Geographic Performance</h3>
              <p className="text-sm text-gray-600">Email engagement by country</p>
            </div>
          </div>

          <div className="space-y-4">
            {geoData.map((country) => {
              const totalActivity = country.opens + country.clicks;
              const activityPercentage = (totalActivity / maxEngagement) * 100;

              return (
                <div
                  key={country.country}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedCountry === country.country
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedCountry(
                    selectedCountry === country.country ? null : country.country
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-lg">
                        {/* Country flag emoji - in a real app, you'd use proper flag icons */}
                        {country.country === 'United States' ? '🇺🇸' :
                         country.country === 'United Kingdom' ? '🇬🇧' :
                         country.country === 'Canada' ? '🇨🇦' :
                         country.country === 'Australia' ? '🇦🇺' :
                         country.country === 'Germany' ? '🇩🇪' : '🌍'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{country.country}</p>
                        <p className="text-sm text-gray-600">
                          {country.uniqueSubscribers.toLocaleString()} subscribers
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {country.engagementRate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">engagement</p>
                    </div>
                  </div>

                  {/* Activity Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${activityPercentage}%` }}
                    ></div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-blue-600">{country.opens.toLocaleString()}</p>
                      <p className="text-gray-600">Opens</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-green-600">{country.clicks.toLocaleString()}</p>
                      <p className="text-gray-600">Clicks</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-red-600">{country.unsubscribes.toLocaleString()}</p>
                      <p className="text-gray-600">Unsubscribes</p>
                    </div>
                  </div>

                  {/* City breakdown (shown when selected) */}
                  {selectedCountry === country.country && country.topCities.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-900 mb-2">Top Cities</p>
                      <div className="space-y-2">
                        {country.topCities.map((city) => (
                          <div key={city.city} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{city.city}</span>
                            <span className="text-gray-500">{city.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Global Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Countries</span>
              <span className="font-semibold">{geoData.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Engagement</span>
              <span className="font-semibold">{totalEngagement.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg. Engagement Rate</span>
              <span className="font-semibold">
                {geoData.length > 0 
                  ? (geoData.reduce((sum, c) => sum + c.engagementRate, 0) / geoData.length).toFixed(1)
                  : 0}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
          <div className="space-y-3">
            {geoData.slice(0, 3).map((country, index) => (
              <div key={country.country} className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{country.country}</p>
                  <p className="text-xs text-gray-600">{country.engagementRate.toFixed(1)}% engagement</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}