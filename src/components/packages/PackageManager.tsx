'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  DollarSign,
  Users,
  Star,
  Package as PackageIcon
} from 'lucide-react';
import { PackageForm } from './PackageForm';
import { PackageAnalytics } from './PackageAnalytics';

interface Package {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  currency: string;
  billingCycle: string;
  status: string;
  isPublic: boolean;
  isFeatured: boolean;
  features: Record<string, any>;
  quotas: Record<string, any>;
  platformCommission: number;
  totalViews: number;
  totalPurchases: number;
  totalRevenue: number;
  averageRating?: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    reviews: number;
    purchases: number;
  };
  analytics?: Array<{
    date: string;
    views: number;
    purchases: number;
    revenue: number;
  }>;
}

export function PackageManager() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [showAnalytics, setShowAnalytics] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-packages', page],
    queryFn: async () => {
      const response = await fetch(`/api/packages/my?page=${page}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch packages');
      return response.json();
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await fetch(`/api/packages/${packageId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete package');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-packages'] });
    },
  });

  const handleDeletePackage = async (packageId: string, packageName: string) => {
    if (window.confirm(`Are you sure you want to delete "${packageName}"? This action cannot be undone.`)) {
      try {
        await deletePackageMutation.mutateAsync(packageId);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete package');
      }
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      PUBLISHED: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      ARCHIVED: 'bg-gray-100 text-gray-600',
    };
    return colors[status as keyof typeof colors] || colors.DRAFT;
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Package Management</h1>
          <p className="text-gray-600">Create and manage your packages</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Package
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Packages</p>
              <p className="text-2xl font-bold text-gray-900">{data?.total || 0}</p>
            </div>
            <PackageIcon className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.packages?.reduce((sum: number, pkg: Package) => sum + pkg.totalPurchases, 0) || 0}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data?.packages?.reduce((sum: number, pkg: Package) => sum + pkg.totalRevenue, 0).toFixed(2) || '0.00'}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Views</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.packages?.reduce((sum: number, pkg: Package) => sum + pkg.totalViews, 0) || 0}
              </p>
            </div>
            <Eye className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Packages List */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Packages</h2>

          {data?.packages?.length === 0 ? (
            <div className="text-center py-12">
              <PackageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No packages yet</h3>
              <p className="text-gray-600 mb-4">Create your first package to start selling to customers.</p>
              <Button onClick={() => setShowCreateModal(true)}>
                Create Your First Package
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.packages?.map((pkg: Package) => (
                <div key={pkg.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                        <Badge className={getStatusColor(pkg.status)}>
                          {pkg.status.replace('_', ' ')}
                        </Badge>
                        {pkg.isPublic && (
                          <Badge variant="secondary">Public</Badge>
                        )}
                        {pkg.isFeatured && (
                          <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span className="font-medium text-gray-900">
                          {formatPrice(pkg.price, pkg.currency, pkg.billingCycle)}
                        </span>
                        <span>{pkg.category.replace('_', ' ')}</span>
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {pkg.totalViews} views
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {pkg.totalPurchases} sales
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${pkg.totalRevenue.toFixed(2)}
                        </div>
                        {pkg.averageRating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            {pkg.averageRating.toFixed(1)} ({pkg.totalReviews})
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAnalytics(pkg.id)}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPackage(pkg)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                        disabled={deletePackageMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

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

      {/* Create Package Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Package"
        size="lg"
      >
        <PackageForm
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['my-packages'] });
          }}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Package Modal */}
      <Modal
        isOpen={!!editingPackage}
        onClose={() => setEditingPackage(null)}
        title="Edit Package"
        size="lg"
      >
        {editingPackage && (
          <PackageForm
            package={editingPackage}
            onSuccess={() => {
              setEditingPackage(null);
              queryClient.invalidateQueries({ queryKey: ['my-packages'] });
            }}
            onCancel={() => setEditingPackage(null)}
          />
        )}
      </Modal>

      {/* Analytics Modal */}
      <Modal
        isOpen={!!showAnalytics}
        onClose={() => setShowAnalytics(null)}
        title="Package Analytics"
        size="xl"
      >
        {showAnalytics && (
          <PackageAnalytics
            packageId={showAnalytics}
            onClose={() => setShowAnalytics(null)}
          />
        )}
      </Modal>
    </div>
  );
}