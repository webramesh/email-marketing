import { NextRequest, NextResponse } from 'next/server'
import { enforcePermission, withPermission, enforceAdmin, withAdmin, rbacPageMiddleware } from '../authorization'
import { Resource, Action } from '../permissions'
import { UserRole } from '@/types'
import { auth } from '@/lib/auth'

// Mock NextAuth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn()
}))

// Mock NextRequest and NextResponse
const mockNextRequest = () => {
  return {
    nextUrl: {
      pathname: '/test-path',
      searchParams: new URLSearchParams(),
    },
    url: 'http://test.com/test-path'
  } as unknown as NextRequest
}

describe('RBAC Authorization Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('enforcePermission', () => {
    it('should return 401 when no session exists', async () => {
      // Mock no session
      (auth as jest.Mock).mockResolvedValue(null)
      
      const request = mockNextRequest()
      const response = await enforcePermission(request, Resource.CAMPAIGNS, Action.READ)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(401)
      
      const responseBody = await response?.json()
      expect(responseBody).toEqual({ error: 'Unauthorized' })
    })
    
    it('should return 403 when user lacks permission', async () => {
      // Mock session with user role that lacks permission
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.SUPPORT }
      })
      
      const request = mockNextRequest()
      const response = await enforcePermission(request, Resource.CAMPAIGNS, Action.DELETE)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(403)
      
      const responseBody = await response?.json()
      expect(responseBody).toEqual({ 
        error: 'Forbidden',
        message: `You don't have permission to delete campaigns`
      })
    })
    
    it('should return null when user has permission', async () => {
      // Mock session with user role that has permission
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.ADMIN }
      })
      
      const request = mockNextRequest()
      const response = await enforcePermission(request, Resource.CAMPAIGNS, Action.READ)
      
      expect(response).toBeNull()
    })
    
    it('should handle errors gracefully', async () => {
      // Mock auth throwing an error
      (auth as jest.Mock).mockRejectedValue(new Error('Test error'))
      
      const request = mockNextRequest()
      const response = await enforcePermission(request, Resource.CAMPAIGNS, Action.READ)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(500)
      
      const responseBody = await response?.json()
      expect(responseBody).toEqual({ error: 'Internal server error' })
    })
  })
  
  describe('withPermission', () => {
    it('should call the handler when user has permission', async () => {
      // Mock session with user role that has permission
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.ADMIN }
      })
      
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )
      
      const wrappedHandler = withPermission(mockHandler, Resource.CAMPAIGNS, Action.READ)
      const request = mockNextRequest()
      
      const response = await wrappedHandler(request)
      
      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
      
      const responseBody = await response.json()
      expect(responseBody).toEqual({ success: true })
    })
    
    it('should not call the handler when user lacks permission', async () => {
      // Mock session with user role that lacks permission
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.SUPPORT }
      })
      
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )
      
      const wrappedHandler = withPermission(mockHandler, Resource.CAMPAIGNS, Action.DELETE)
      const request = mockNextRequest()
      
      const response = await wrappedHandler(request)
      
      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)
    })
  })
  
  describe('enforceAdmin', () => {
    it('should return 401 when no session exists', async () => {
      // Mock no session
      (auth as jest.Mock).mockResolvedValue(null)
      
      const request = mockNextRequest()
      const response = await enforceAdmin(request)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(401)
    })
    
    it('should return 403 when user is not an admin', async () => {
      // Mock session with non-admin user
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.USER }
      })
      
      const request = mockNextRequest()
      const response = await enforceAdmin(request)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(403)
      
      const responseBody = await response?.json()
      expect(responseBody).toEqual({ 
        error: 'Forbidden',
        message: 'This action requires administrator privileges'
      })
    })
    
    it('should return null when user is an admin', async () => {
      // Mock session with admin user
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.ADMIN }
      })
      
      const request = mockNextRequest()
      const response = await enforceAdmin(request)
      
      expect(response).toBeNull()
    })
  })
  
  describe('withAdmin', () => {
    it('should call the handler when user is an admin', async () => {
      // Mock session with admin user
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.ADMIN }
      })
      
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )
      
      const wrappedHandler = withAdmin(mockHandler)
      const request = mockNextRequest()
      
      const response = await wrappedHandler(request)
      
      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
    })
    
    it('should not call the handler when user is not an admin', async () => {
      // Mock session with non-admin user
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.USER }
      })
      
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )
      
      const wrappedHandler = withAdmin(mockHandler)
      const request = mockNextRequest()
      
      const response = await wrappedHandler(request)
      
      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)
    })
  })
  
  describe('rbacPageMiddleware', () => {
    it('should return null when path does not match any resource path', async () => {
      const request = mockNextRequest()
      const resourcePathMap = {
        '/admin': { resource: Resource.SYSTEM_SETTINGS, action: Action.MANAGE }
      }
      
      const response = await rbacPageMiddleware(request, resourcePathMap)
      
      expect(response).toBeNull()
    })
    
    it('should redirect to login when no session exists', async () => {
      // Mock no session
      (auth as jest.Mock).mockResolvedValue(null)
      
      const request = {
        ...mockNextRequest(),
        nextUrl: {
          pathname: '/admin/users',
          searchParams: new URLSearchParams()
        }
      } as unknown as NextRequest
      
      const resourcePathMap = {
        '/admin/users': { resource: Resource.USERS, action: Action.MANAGE }
      }
      
      const response = await rbacPageMiddleware(request, resourcePathMap)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(307) // Temporary redirect
      expect(response?.headers.get('location')).toContain('/auth/signin')
    })
    
    it('should redirect to forbidden page when user lacks permission', async () => {
      // Mock session with user role that lacks permission
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.USER }
      })
      
      const request = {
        ...mockNextRequest(),
        nextUrl: {
          pathname: '/admin/users',
          searchParams: new URLSearchParams()
        }
      } as unknown as NextRequest
      
      const resourcePathMap = {
        '/admin/users': { resource: Resource.USERS, action: Action.MANAGE }
      }
      
      const response = await rbacPageMiddleware(request, resourcePathMap)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.headers.get('location')).toContain('/forbidden')
    })
    
    it('should return null when user has permission', async () => {
      // Mock session with user role that has permission
      (auth as jest.Mock).mockResolvedValue({
        user: { role: UserRole.ADMIN }
      })
      
      const request = {
        ...mockNextRequest(),
        nextUrl: {
          pathname: '/admin/users',
          searchParams: new URLSearchParams()
        }
      } as unknown as NextRequest
      
      const resourcePathMap = {
        '/admin/users': { resource: Resource.USERS, action: Action.MANAGE }
      }
      
      const response = await rbacPageMiddleware(request, resourcePathMap)
      
      expect(response).toBeNull()
    })
  })
})