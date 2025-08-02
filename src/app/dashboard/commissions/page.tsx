'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Package,
  Users,
  Calendar
} from 'lucide-react';

interface Commission {
  id: string;
  totalAmount: number;
  platformCommission: number;
  sellerRevenue: number;
  currency: string;
  commissionStatus: string;
  commissionPaidAt?: string;
  transactionId?: string;
  createdAt: string;
  package: {
    id: string;
    name: string;
  };
  purchase: {
    customer: {
      name: string;
    };
  };
}

export default function CommissionsPage() {
  const { data: session } = useSession();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['commissions', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/packages/commissions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch commissions');
      return response.json();
    },
    enabled: !!session && ['ADMIN', 'SUPERADMIN'].includes(session.user?.role || ''),
  });

  if (!session || !['ADMIN', 'SUPERADMIN'].includes(session.user?.role || '')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Access Denied
          </h3>
          <p className="text-gray-600">
            Only admin companies can view commission information.
          </p>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      DISPUTED: 'bg-purple-100 text-purple-800',
    };
    return colors[status as keyof typeof colors] || colors.PENDING;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'PROCESSING':
        return <TrendingUp className="w-4 h-4" />;
      case 'PAID':
        return <CheckCircle className="w-4 h-4" />;
      case 'FAILED':
      case 'DISPUTED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Calculate summary statistics
  const summary = data?.commissions?.reduce(
    (acc: any, commission: Commission) => {
      acc.totalEarnings += commission.sellerRevenue;
      acc.totalSales += commission.totalAmount;
      acc.pendingAmount += commission.commissionStatus === 'PENDING' ? commission.sellerRevenue : 0;
      acc.paidAmount += commission.commissionStatus === 'PAID' ? commission.sellerRevenue : 0;
      return acc;
    },
    { totalEarnings: 0, totalSales: 0, pendingAmount: 0, paidAmount: 0 }
  ) || { totalEarnings: 0, totalSales: 0, pendingAmount: 0, paidAmount: 0 };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load commissions. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Dashboard</h1>
          <p className="text-gray-600">Track your earnings from package sales</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalEarnings)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalSales)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.pendingAmount)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paid Out</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.paidAmount)}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="DISPUTED">Disputed</option>
          </select>
        </div>
      </Card>

      {/* Commissions List */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission History</h2>
          
          {data?.commissions?.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No commissions yet</h3>
              <p className="text-gray-600">
                Start selling packages to earn commissions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.commissions?.map((commission: Commission) => (
                <div key={commission.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Package className="w-5 h-5 text-gray-400" />
                        <h3 className="font-semibold text-gray-900">
                          {commission.package.name}
                        </h3>
                        <Badge className={getStatusColor(commission.commissionStatus)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(commission.commissionStatus)}
                            {commission.commissionStatus}
                          </div>
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {commission.purchase.customer.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(commission.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        {commission.commissionPaidAt && (
                          <div className="text-green-600">
                            Paid on {new Date(commission.commissionPaidAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                        {commission.transactionId && (
                          <div className="text-xs text-gray-500">
                            TX: {commission.transactionId}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatCurrency(commission.sellerRevenue, commission.currency)}
                      </div>
                      <div className="text-sm text-gray-600">
                        from {formatCurrency(commission.totalAmount, commission.currency)} sale
                      </div>
                      <div className="text-xs text-gray-500">
                        Platform fee: {formatCurrency(commission.platformCommission, commission.currency)}
                      </div>
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
    </div>
  );
}