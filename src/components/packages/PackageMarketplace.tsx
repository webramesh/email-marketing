'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Star, Search, Filter, ShoppingCart, Eye, Users } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  description?: string;
  shortDescription?: string;
  category: string;
  price: number;
  currency: string;
  billingCycle: string;
  averageRating?: number;
  totalReviews: number;
  totalPurchases: number;
  images?: string[];
  tags?: string[];
  highlights?: string[];
  creator: {
    id: string;
    name: string;
    subdomain: string;
  };
  _count: {
    reviews: number;
    purchases: number;
  };
}

interface PackageFilters {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
  tags?: string[];
}

export function PackageMarketplace() {
  const [filters, setFilters] = useState<PackageFilters>({});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['packages', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        isPublic: 'true',
        page: page.toString(),
        limit: '12',
      });

      if (filters.category) params.append('category', filters.category);
      if (filters.priceMin) params.append('priceMin', filters.priceMin.toString());
      if (filters.priceMax) params.append('priceMax', filters.priceMax.toString());
      if (filters.search) params.append('search', filters.search);
      if (filters.tags?.length) params.append('tags', filters.tags.join(','));

      const response = await fetch(`/api/packages?${params}`);
      if (!response.ok) throw new Error('Failed to fetch packages');
      return response.json();
    },
  });

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search }));
    setPage(1);
  };

  const handleFilterChange = (newFilters: Partial<PackageFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const formatPrice = (price: number, currency: string, billingCycle: string) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);

    const cycleMap = {
      MONTHLY: '/month',
      QUARTERLY: '/quarter',
      YEARLY: '/year',
      ONE_TIME: 'one-time',
    };

    return `${formatted}${cycleMap[billingCycle as keyof typeof cycleMap] || ''}`;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      EMAIL_MARKETING: 'bg-blue-100 text-blue-800',
      AUTOMATION: 'bg-green-100 text-green-800',
      ANALYTICS: 'bg-purple-100 text-purple-800',
      INTEGRATIONS: 'bg-orange-100 text-orange-800',
      TEMPLATES: 'bg-pink-100 text-pink-800',
      CUSTOM: 'bg-gray-100 text-gray-800',
    };
    return colors[category as keyof typeof colors] || colors.CUSTOM;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load packages. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Package Marketplace</h1>
          <p className="text-gray-600">Discover and purchase packages from admin companies</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search packages..."
              className="pl-10 w-64"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                value={filters.category || ''}
                onChange={(e) => handleFilterChange({ category: e.target.value || undefined })}
              >
                <option value="">All Categories</option>
                <option value="EMAIL_MARKETING">Email Marketing</option>
                <option value="AUTOMATION">Automation</option>
                <option value="ANALYTICS">Analytics</option>
                <option value="INTEGRATIONS">Integrations</option>
                <option value="TEMPLATES">Templates</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Price
              </label>
              <Input
                type="number"
                placeholder="0"
                value={filters.priceMin || ''}
                onChange={(e) => handleFilterChange({ 
                  priceMin: e.target.value ? parseFloat(e.target.value) : undefined 
                })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Price
              </label>
              <Input
                type="number"
                placeholder="1000"
                value={filters.priceMax || ''}
                onChange={(e) => handleFilterChange({ 
                  priceMax: e.target.value ? parseFloat(e.target.value) : undefined 
                })}
              />
            </div>
            
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({});
                  setPage(1);
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.packages?.map((pkg: Package) => (
          <Card key={pkg.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            {/* Package Image */}
            <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 relative">
              {pkg.images?.[0] ? (
                <img
                  src={pkg.images[0]}
                  alt={pkg.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <ShoppingCart className="w-12 h-12 text-white opacity-50" />
                </div>
              )}
              <div className="absolute top-2 right-2">
                <Badge className={getCategoryColor(pkg.category)}>
                  {pkg.category.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            <div className="p-4">
              {/* Package Header */}
              <div className="mb-3">
                <h3 className="font-semibold text-lg text-gray-900 mb-1">{pkg.name}</h3>
                <p className="text-sm text-gray-600 mb-2">
                  by {pkg.creator.name}
                </p>
                {pkg.shortDescription && (
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {pkg.shortDescription}
                  </p>
                )}
              </div>

              {/* Rating and Stats */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {pkg.averageRating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium">{pkg.averageRating.toFixed(1)}</span>
                      <span className="text-sm text-gray-500">({pkg.totalReviews})</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {pkg._count.purchases}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {pkg.tags && pkg.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {pkg.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {pkg.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{pkg.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Price and Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatPrice(pkg.price, pkg.currency, pkg.billingCycle)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/packages/${pkg.id}`, '_blank')}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.location.href = `/packages/${pkg.id}/purchase`}
                  >
                    Purchase
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {data?.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          
          <span className="text-sm text-gray-600">
            Page {page} of {data.totalPages}
          </span>
          
          <Button
            variant="outline"
            disabled={page === data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Empty State */}
      {data?.packages?.length === 0 && (
        <div className="text-center py-12">
          <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No packages found</h3>
          <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
        </div>
      )}
    </div>
  );
}