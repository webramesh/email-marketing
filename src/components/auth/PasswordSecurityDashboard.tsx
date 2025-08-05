'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PasswordSecurityStatus {
  isExpired: boolean;
  isCompromised: boolean;
  mustChange: boolean;
  daysUntilExpiration?: number;
  lastChanged?: string;
  securityScore: number;
  recommendations: string[];
}

interface PasswordAuditResult {
  totalUsers: number;
  compromisedPasswords: number;
  expiredPasswords: number;
  weakPasswords: number;
  lockedAccounts: number;
  recommendations: string[];
}

interface PasswordSecurityDashboardProps {
  showAudit?: boolean;
  userRole?: string;
}

export function PasswordSecurityDashboard({ showAudit = false, userRole }: PasswordSecurityDashboardProps) {
  const [status, setStatus] = useState<PasswordSecurityStatus | null>(null);
  const [auditResult, setAuditResult] = useState<PasswordAuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPasswordStatus();
    if (showAudit) {
      fetchAuditData();
    }
  }, [showAudit]);

  const fetchPasswordStatus = async () => {
    try {
      const response = await fetch('/api/auth/password-security');
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      } else {
        setError('Failed to load password security status');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditData = async () => {
    if (!showAudit || !['ADMIN', 'SUPERADMIN'].includes(userRole || '')) return;
    
    setAuditLoading(true);
    try {
      const response = await fetch('/api/auth/password-security?action=audit');
      if (response.ok) {
        const data = await response.json();
        setAuditResult(data.audit);
      }
    } catch (error) {
      console.error('Failed to fetch audit data:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  const getSecurityLevel = () => {
    if (!status) return { level: 'unknown', color: 'gray', text: 'Unknown' };
    
    const score = status.securityScore;
    
    if (status.isCompromised) {
      return { level: 'critical', color: 'red', text: 'Critical - Compromised' };
    }
    
    if (status.isExpired || status.mustChange) {
      return { level: 'high', color: 'red', text: 'High Risk - Expired' };
    }
    
    if (score >= 90) {
      return { level: 'excellent', color: 'green', text: 'Excellent' };
    } else if (score >= 75) {
      return { level: 'good', color: 'blue', text: 'Good' };
    } else if (score >= 60) {
      return { level: 'fair', color: 'yellow', text: 'Fair' };
    } else if (score >= 40) {
      return { level: 'poor', color: 'orange', text: 'Poor' };
    } else {
      return { level: 'critical', color: 'red', text: 'Critical' };
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>{error}</p>
          <Button onClick={fetchPasswordStatus} className="mt-2">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const securityLevel = getSecurityLevel();

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Password Security</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            securityLevel.color === 'red' ? 'bg-red-100 text-red-800' :
            securityLevel.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
            securityLevel.color === 'blue' ? 'bg-blue-100 text-blue-800' :
            securityLevel.color === 'green' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {securityLevel.text}
          </div>
        </div>

        {/* Security Score */}
        {status && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Security Score</span>
              <span className={`text-lg font-bold ${
                status.securityScore >= 90 ? 'text-green-600' :
                status.securityScore >= 75 ? 'text-blue-600' :
                status.securityScore >= 60 ? 'text-yellow-600' :
                status.securityScore >= 40 ? 'text-orange-600' :
                'text-red-600'
              }`}>
                {status.securityScore}/100
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  status.securityScore >= 90 ? 'bg-green-500' :
                  status.securityScore >= 75 ? 'bg-blue-500' :
                  status.securityScore >= 60 ? 'bg-yellow-500' :
                  status.securityScore >= 40 ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${status.securityScore}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Password Age */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Last Changed</span>
              <span className="text-sm text-gray-900">{formatDate(status?.lastChanged)}</span>
            </div>
          </div>

          {/* Expiration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Expires In</span>
              <span className={`text-sm font-medium ${
                status?.daysUntilExpiration && status.daysUntilExpiration <= 7 ? 'text-red-600' :
                status?.daysUntilExpiration && status.daysUntilExpiration <= 30 ? 'text-yellow-600' :
                'text-gray-900'
              }`}>
                {status?.daysUntilExpiration 
                  ? `${status.daysUntilExpiration} days`
                  : 'Never'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Security Alerts */}
        {status && (status.isCompromised || status.isExpired || status.mustChange) && (
          <div className="space-y-3">
            {status.isCompromised && (
              <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <svg className="w-5 h-5 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-red-800">Password Compromised</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Your password has been found in data breaches. Please change it immediately.
                  </p>
                </div>
              </div>
            )}

            {(status.isExpired || status.mustChange) && !status.isCompromised && (
              <div className="flex items-start space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Password Expired</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Your password has expired and needs to be changed.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personalized Recommendations */}
        {status && status.recommendations.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Security Recommendations</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              {status.recommendations.map((recommendation, index) => (
                <li key={index}>• {recommendation}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Audit Results for Admins */}
        {showAudit && ['ADMIN', 'SUPERADMIN'].includes(userRole || '') && (
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Password Security Audit</h4>
              <Button
                onClick={fetchAuditData}
                variant="outline"
                disabled={auditLoading}
                className="text-sm"
              >
                {auditLoading ? 'Loading...' : 'Refresh Audit'}
              </Button>
            </div>

            {auditResult && (
              <div className="space-y-4">
                {/* Audit Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{auditResult.totalUsers}</div>
                    <div className="text-xs text-gray-600">Total Users</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">{auditResult.compromisedPasswords}</div>
                    <div className="text-xs text-red-600">Compromised</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-600">{auditResult.expiredPasswords}</div>
                    <div className="text-xs text-yellow-600">Expired</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">{auditResult.weakPasswords}</div>
                    <div className="text-xs text-orange-600">Weak</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">{auditResult.lockedAccounts}</div>
                    <div className="text-xs text-purple-600">Locked</div>
                  </div>
                </div>

                {/* Audit Recommendations */}
                {auditResult.recommendations.length > 0 && (
                  <div className="bg-amber-50 p-4 rounded-lg">
                    <h5 className="text-sm font-medium text-amber-800 mb-2">Audit Recommendations</h5>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {auditResult.recommendations.map((recommendation, index) => (
                        <li key={index}>• {recommendation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3">
          <Button
            onClick={() => window.location.href = '/dashboard/profile?tab=security'}
            variant={status?.mustChange ? 'primary' : 'secondary'}
            className={status?.mustChange ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {status?.mustChange ? 'Change Password Now' : 'Change Password'}
          </Button>
          
          <Button
            onClick={fetchPasswordStatus}
            variant="outline"
          >
            Refresh Status
          </Button>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-gray-500 text-center">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>
    </Card>
  );
}