import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getTenantSubdomain } from '@/lib/utils';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
}

interface TenantContextType {
  /**
   * Current tenant
   */
  currentTenant: Tenant | null;
  
  /**
   * Available tenants for the user
   */
  availableTenants: Tenant[];
  
  /**
   * Switch to a different tenant
   */
  switchTenant: (tenantId: string) => void;
  
  /**
   * Whether the tenant is loading
   */
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export interface TenantProviderProps {
  /**
   * Children components
   */
  children: React.ReactNode;
}

/**
 * Provider component for tenant context
 */
export function TenantProvider({ children }: TenantProviderProps) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  
  // Mock tenants for demonstration
  const mockTenants: Tenant[] = [
    { id: '1', name: 'Acme Inc', subdomain: 'acme' },
    { id: '2', name: 'Globex Corp', subdomain: 'globex' },
    { id: '3', name: 'Stark Industries', subdomain: 'stark' },
  ];
  
  // Resolve tenant from hostname on initial load
  useEffect(() => {
    const resolveTenant = () => {
      setIsLoading(true);
      
      try {
        // In a real implementation, this would make an API call to resolve the tenant
        const hostname = window.location.hostname;
        const subdomain = getTenantSubdomain(hostname);
        
        // Find tenant by subdomain or use first available tenant
        const tenant = subdomain
          ? mockTenants.find(t => t.subdomain === subdomain) || mockTenants[0]
          : mockTenants[0];
        
        setCurrentTenant(tenant);
        setAvailableTenants(mockTenants);
      } catch (error) {
        console.error('Error resolving tenant:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    resolveTenant();
  }, []);
  
  // Switch to a different tenant
  const switchTenant = (tenantId: string) => {
    const tenant = mockTenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      
      // In a real implementation, this would redirect to the tenant's subdomain
      // window.location.href = `https://${tenant.subdomain}.example.com${pathname}`;
      
      // For demonstration, just log the switch
      console.log(`Switched to tenant: ${tenant.name} (${tenant.subdomain})`);
    }
  };
  
  const value = {
    currentTenant,
    availableTenants,
    switchTenant,
    isLoading,
  };
  
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Hook to use tenant context
 */
export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}