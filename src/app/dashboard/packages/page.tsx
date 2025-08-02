'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { PackageManager } from '@/components/packages/PackageManager';
import { PackageMarketplace } from '@/components/packages/PackageMarketplace';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Package, ShoppingCart, DollarSign, Users } from 'lucide-react';

export default function PackagesPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'marketplace' | 'manage'>('marketplace');

  // Show marketplace by default, but allow admins to switch to management
  const canManagePackages = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to access packages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
            <p className="text-gray-600">
              {activeTab === 'marketplace' 
                ? 'Discover and purchase packages from admin companies'
                : 'Create and manage your packages'
              }
            </p>
          </div>
        </div>

        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'marketplace'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Marketplace
            </div>
          </button>

          {canManagePackages && (
            <button
              onClick={() => setActiveTab('manage')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'manage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                My Packages
              </div>
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'marketplace' && <PackageMarketplace />}
      {activeTab === 'manage' && canManagePackages && <PackageManager />}
      
      {/* Access Denied for Package Management */}
      {activeTab === 'manage' && !canManagePackages && (
        <Card className="p-8 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Package Management Not Available
          </h3>
          <p className="text-gray-600 mb-4">
            Only admin companies can create and manage packages. 
            Contact support to upgrade your account.
          </p>
          <Button onClick={() => setActiveTab('marketplace')}>
            Browse Marketplace
          </Button>
        </Card>
      )}
    </div>
  );
}