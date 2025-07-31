"use client"

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface TenantOption {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
}

interface TenantSwitcherProps {
  className?: string;
}

export function TenantSwitcher({ className }: TenantSwitcherProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!session?.user.availableTenants || session.user.availableTenants.length <= 1) {
    return null;
  }

  const currentTenant = session.user.tenant;
  const availableTenants = session.user.availableTenants;

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId === currentTenant.id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    try {
      // Re-authenticate with the selected tenant
      const result = await signIn('credentials', {
        email: session.user.email,
        tenantId: tenantId,
        redirect: false,
      });

      if (result?.ok) {
        // Refresh the page to load the new tenant context
        window.location.reload();
      } else {
        console.error('Failed to switch tenant');
      }
    } catch (error) {
      console.error('Error switching tenant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="truncate max-w-32">{currentTenant.name}</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
        </div>
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Switch Account"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-4">
            Select the account you want to switch to:
          </p>

          {availableTenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => handleTenantSwitch(tenant.id)}
              disabled={isLoading}
              className={`w-full p-4 text-left border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${tenant.id === currentTenant.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{tenant.name}</div>
                  <div className="text-sm text-gray-500">
                    {tenant.customDomain || `${tenant.subdomain}.yourdomain.com`}
                  </div>
                </div>
                {tenant.id === currentTenant.id && (
                  <div className="flex items-center text-blue-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}