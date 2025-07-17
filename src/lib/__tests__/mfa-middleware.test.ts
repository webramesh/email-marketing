import { NextRequest, NextResponse } from 'next/server';
import {
  requiresMFA,
  createMFASession,
  hasValidMFASession,
  clearMFASession,
  enforceMFA,
} from '../mfa-middleware';
import { auth } from '../auth';
import { isMFAEnabled } from '../mfa';
import type { Session } from 'next-auth';

// Mock dependencies
jest.mock('../auth');
jest.mock('../mfa');

// Define the return type of auth function
const mockAuth = jest.mocked(auth);
const mockIsMFAEnabled = jest.mocked(isMFAEnabled);

describe('MFA Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requiresMFA', () => {
    test('should return true for sensitive paths', () => {
      expect(requiresMFA('/api/auth/mfa/disable')).toBe(true);
      expect(requiresMFA('/api/users/delete')).toBe(true);
      expect(requiresMFA('/api/billing/cancel')).toBe(true);
      expect(requiresMFA('/api/settings/security')).toBe(true);
      expect(requiresMFA('/api/admin')).toBe(true);
    });

    test('should return false for non-sensitive paths', () => {
      expect(requiresMFA('/api/users/list')).toBe(false);
      expect(requiresMFA('/api/campaigns')).toBe(false);
      expect(requiresMFA('/dashboard')).toBe(false);
    });
  });

  describe('MFA Session Management', () => {
    test('should create MFA session', () => {
      createMFASession('user1', 'tenant1');
      expect(hasValidMFASession('user1', 'tenant1')).toBe(true);
    });

    test('should clear MFA session', () => {
      createMFASession('user1', 'tenant1');
      clearMFASession('user1', 'tenant1');
      expect(hasValidMFASession('user1', 'tenant1')).toBe(false);
    });

    test('should expire MFA session after timeout', () => {
      createMFASession('user1', 'tenant1');

      // Mock time passage
      jest.useFakeTimers();
      jest.advanceTimersByTime(31 * 60 * 1000); // 31 minutes

      expect(hasValidMFASession('user1', 'tenant1')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('enforceMFA', () => {
    const createMockRequest = (pathname: string) => {
      return {
        nextUrl: { pathname },
      } as NextRequest;
    };

    test('should allow non-sensitive paths without MFA', async () => {
      const request = createMockRequest('/api/campaigns');
      const response = await enforceMFA(request);
      expect(response).toBeNull();
    });

    test('should require authentication for sensitive paths', async () => {
      const request = createMockRequest('/api/auth/mfa/disable');
      mockAuth.mockResolvedValue(null);

      const response = await enforceMFA(request);
      expect(response).toBeInstanceOf(NextResponse);

      const responseData = await response!.json();
      expect(responseData.error).toBe('Unauthorized');
    });

    test('should require MFA setup when not enabled', async () => {
      const request = createMockRequest('/api/auth/mfa/disable');
      const mockSession = {
        user: {
          id: 'user1',
          tenantId: 'tenant1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          tenant: {
            id: 'tenant1',
            name: 'Test Tenant',
            subdomain: 'test',
          },
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      mockAuth.mockResolvedValue(mockSession as any);
      mockIsMFAEnabled.mockResolvedValue(false);

      const response = await enforceMFA(request);
      expect(response).toBeInstanceOf(NextResponse);

      const responseData = await response!.json();
      expect(responseData.error).toBe('MFA required');
      expect(responseData.requireMFASetup).toBe(true);
    });

    test('should require MFA verification when no valid session', async () => {
      const request = createMockRequest('/api/auth/mfa/disable');
      const mockSession = {
        user: {
          id: 'user1',
          tenantId: 'tenant1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          tenant: {
            id: 'tenant1',
            name: 'Test Tenant',
            subdomain: 'test',
          },
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      mockAuth.mockResolvedValue(mockSession as any);
      mockIsMFAEnabled.mockResolvedValue(true);

      const response = await enforceMFA(request);
      expect(response).toBeInstanceOf(NextResponse);

      const responseData = await response!.json();
      expect(responseData.error).toBe('MFA verification required');
      expect(responseData.requireMFAVerification).toBe(true);
    });

    test('should allow access with valid MFA session', async () => {
      const request = createMockRequest('/api/auth/mfa/disable');
      const mockSession = {
        user: {
          id: 'user1',
          tenantId: 'tenant1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          tenant: {
            id: 'tenant1',
            name: 'Test Tenant',
            subdomain: 'test',
          },
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      mockAuth.mockResolvedValue(mockSession as any);
      mockIsMFAEnabled.mockResolvedValue(true);

      // Create valid MFA session
      createMFASession('user1', 'tenant1');

      const response = await enforceMFA(request);
      expect(response).toBeNull();
    });
  });
});
