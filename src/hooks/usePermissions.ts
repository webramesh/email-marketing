/**
 * Permission Hooks
 * React hooks for checking permissions and managing package-based access
 */

import { useState, useEffect, useCallback } from 'react';
import { Resource, Action } from '@/lib/rbac/permissions';

interface PermissionContext {
  user: {
    id: string;
    role: string;
    tenantId: string;
  };
  packages: Array<{
    id: string;
    name: string;
    tier: string;
    status: string;
  }>;
  features: Record<string, any>;
  quotas: Record<string, number>;
  usage: Record<string, number>;
  quotaStatus: Record<string, { used: number; limit: number; exceeded: boolean }>;
  restrictions: string[];
}

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  quotaStatus?: { used: number; limit: number; exceeded: boolean };
  context?: {
    hasRolePermission: boolean;
    hasPackagePermission: boolean;
    restrictions: string[];
  };
}

interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  usage?: { used: number; limit: number };
}

interface FeatureCheckResult {
  available: boolean;
  reason?: string;
  features?: Record<string, any>;
}

/**
 * Hook for getting current user's permission context
 */
export function usePermissionContext() {
  const [context, setContext] = useState<PermissionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/permissions/check');
      const data = await response.json();

      if (response.ok) {
        setContext(data);
      } else {
        setError(data.error || 'Failed to load permission context');
      }
    } catch (err) {
      setError('Network error loading permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  return {
    context,
    loading,
    error,
    reload: loadContext
  };
}

/**
 * Hook for checking specific permissions
 */
export function usePermissionCheck() {
  const [loading, setLoading] = useState(false);

  const checkPermission = useCallback(async (
    resource: Resource,
    action: Action,
    userId?: string
  ): Promise<PermissionCheckResult> => {
    try {
      setLoading(true);

      const response = await fetch('/api/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'permission',
          resource,
          permissionAction: action,
          userId
        })
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return {
          allowed: false,
          reason: data.error || 'Permission check failed'
        };
      }
    } catch (error) {
      return {
        allowed: false,
        reason: 'Network error checking permission'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const checkQuota = useCallback(async (
    quotaType: string,
    increment: number = 1,
    userId?: string
  ): Promise<QuotaCheckResult> => {
    try {
      setLoading(true);

      const response = await fetch('/api/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quota',
          quotaType,
          increment,
          userId
        })
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return {
          allowed: false,
          reason: data.error || 'Quota check failed'
        };
      }
    } catch (error) {
      return {
        allowed: false,
        reason: 'Network error checking quota'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const checkFeature = useCallback(async (
    featureKey: string,
    userId?: string
  ): Promise<FeatureCheckResult> => {
    try {
      setLoading(true);

      const response = await fetch('/api/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feature',
          featureKey,
          userId
        })
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return {
          available: false,
          reason: data.error || 'Feature check failed'
        };
      }
    } catch (error) {
      return {
        available: false,
        reason: 'Network error checking feature'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    checkPermission,
    checkQuota,
    checkFeature,
    loading
  };
}

/**
 * Hook for checking if user has specific permission (with caching)
 */
export function useHasPermission(resource: Resource, action: Action, userId?: string) {
  const [result, setResult] = useState<PermissionCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { checkPermission } = usePermissionCheck();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const result = await checkPermission(resource, action, userId);
      if (mounted) {
        setResult(result);
        setLoading(false);
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, [resource, action, userId, checkPermission]);

  return {
    allowed: result?.allowed || false,
    reason: result?.reason,
    context: result?.context,
    loading
  };
}

/**
 * Hook for checking if user has specific feature
 */
export function useHasFeature(featureKey: string, userId?: string) {
  const [result, setResult] = useState<FeatureCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { checkFeature } = usePermissionCheck();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const result = await checkFeature(featureKey, userId);
      if (mounted) {
        setResult(result);
        setLoading(false);
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, [featureKey, userId, checkFeature]);

  return {
    available: result?.available || false,
    reason: result?.reason,
    features: result?.features,
    loading
  };
}

/**
 * Hook for checking quota status
 */
export function useQuotaStatus(quotaType: string, userId?: string) {
  const [result, setResult] = useState<QuotaCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { checkQuota } = usePermissionCheck();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const result = await checkQuota(quotaType, 0, userId); // Check without increment
      if (mounted) {
        setResult(result);
        setLoading(false);
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, [quotaType, userId, checkQuota]);

  const checkBeforeAction = useCallback(async (increment: number = 1) => {
    return await checkQuota(quotaType, increment, userId);
  }, [quotaType, userId, checkQuota]);

  return {
    allowed: result?.allowed || false,
    usage: result?.usage,
    reason: result?.reason,
    loading,
    checkBeforeAction
  };
}

/**
 * Hook for managing user permissions (admin only)
 */
export function usePermissionManagement() {
  const [loading, setLoading] = useState(false);

  const assignPackage = useCallback(async (
    userId: string,
    packageId: string,
    options?: {
      reason?: string;
      customFeatures?: Record<string, any>;
      customQuotas?: Record<string, number>;
      expiresAt?: string;
    }
  ) => {
    try {
      setLoading(true);

      const response = await fetch('/api/permissions/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          userId,
          packageId,
          ...options
        })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    } finally {
      setLoading(false);
    }
  }, []);

  const removePackage = useCallback(async (
    userId: string,
    packageId: string,
    reason?: string
  ) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        userId,
        packageId,
        ...(reason && { reason })
      });

      const response = await fetch(`/api/permissions/packages?${params}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkUpdatePermissions = useCallback(async (
    userIds: string[],
    options: {
      packageId?: string;
      templateId?: string;
      features?: Record<string, any>;
      quotas?: Record<string, number>;
      reason?: string;
    }
  ) => {
    try {
      setLoading(true);

      const response = await fetch('/api/permissions/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_update',
          userIds,
          ...options
        })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, results: data.results };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    assignPackage,
    removePackage,
    bulkUpdatePermissions,
    loading
  };
}