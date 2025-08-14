'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Form } from '@/components/ui/Form';

interface SecurityMetrics {
  totalLoginAttempts: number;
  failedLoginAttempts: number;
  successfulLogins: number;
  blockedAttempts: number;
  activeThreats: number;
  resolvedThreats: number;
  topThreatTypes: Array<{ type: string; count: number }>;
  topRiskyIPs: Array<{ ipAddress: string; attempts: number }>;
  loginsByCountry: Array<{ country: string; attempts: number }>;
  riskScoreDistribution: Array<{ range: string; count: number }>;
}

interface SecurityThreat {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: any;
  metadata?: Record<string, any>;
  isActive: boolean;
  detectedAt: string;
  resolvedAt?: string;
}

export function SecurityDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [threats, setThreats] = useState<SecurityThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [selectedThreat, setSelectedThreat] = useState<SecurityThreat | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showRestrictionsModal, setShowRestrictionsModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [restrictionForm, setRestrictionForm] = useState({
    type: 'ip' as 'ip' | 'geolocation',
    ipAddress: '',
    countryCode: '',
    restrictionType: 'BLOCK' as 'ALLOW' | 'BLOCK',
    reason: '',
    expiresAt: '',
  });

  useEffect(() => {
    fetchSecurityData();
  }, [dateRange]);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsResponse, threatsResponse] = await Promise.all([
        fetch(`/api/security/monitoring?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
        fetch('/api/security/threats'),
      ]);

      if (!metricsResponse.ok || !threatsResponse.ok) {
        throw new Error('Failed to fetch security data');
      }

      const metricsData = await metricsResponse.json();
      const threatsData = await threatsResponse.json();

      setMetrics(metricsData.data.metrics);
      setThreats(threatsData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveThreat = async () => {
    if (!selectedThreat || !resolution.trim()) return;

    try {
      const response = await fetch('/api/security/threats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threatId: selectedThreat.id,
          resolution: resolution.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve threat');
      }

      // Refresh threats data
      await fetchSecurityData();
      setShowResolveModal(false);
      setSelectedThreat(null);
      setResolution('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve threat');
    }
  };

  const handleAddRestriction = async () => {
    try {
      const body = {
        restrictionType: restrictionForm.type,
        type: restrictionForm.restrictionType,
        reason: restrictionForm.reason,
        ...(restrictionForm.type === 'ip' && {
          ipAddress: restrictionForm.ipAddress,
          ...(restrictionForm.expiresAt && { expiresAt: restrictionForm.expiresAt }),
        }),
        ...(restrictionForm.type === 'geolocation' && {
          countryCode: restrictionForm.countryCode.toUpperCase(),
        }),
      };

      const response = await fetch('/api/security/restrictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to add restriction');
      }

      setShowRestrictionsModal(false);
      setRestrictionForm({
        type: 'ip',
        ipAddress: '',
        countryCode: '',
        restrictionType: 'BLOCK',
        reason: '',
        expiresAt: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add restriction');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <Button onClick={fetchSecurityData} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Security Dashboard</h1>
        <div className="flex space-x-4">
          <Button
            onClick={() => setShowRestrictionsModal(true)}
            variant="outline"
          >
            Add Restrictions
          </Button>
          <Button onClick={fetchSecurityData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card className="p-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <Input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      {/* Security Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Login Attempts</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalLoginAttempts.toLocaleString()}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Failed Attempts</p>
                <p className="text-2xl font-bold text-red-600">{metrics.failedLoginAttempts.toLocaleString()}</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Blocked Attempts</p>
                <p className="text-2xl font-bold text-orange-600">{metrics.blockedAttempts.toLocaleString()}</p>
              </div>
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Active Threats</p>
                <p className="text-2xl font-bold text-red-600">{metrics.activeThreats.toLocaleString()}</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Active Threats */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Security Threats</h2>
        {threats.length === 0 ? (
          <p className="text-gray-500">No active threats detected.</p>
        ) : (
          <div className="space-y-4">
            {threats.map((threat) => (
              <div key={threat.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge className={getSeverityColor(threat.severity)}>
                        {threat.severity}
                      </Badge>
                      <span className="text-sm text-gray-500">{threat.type}</span>
                    </div>
                    <p className="text-gray-900 mb-2">{threat.description}</p>
                    <div className="text-sm text-gray-500 space-y-1">
                      {threat.ipAddress && <p>IP: {threat.ipAddress}</p>}
                      {threat.location && (
                        <p>Location: {threat.location.city}, {threat.location.country}</p>
                      )}
                      <p>Detected: {new Date(threat.detectedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedThreat(threat);
                      setShowResolveModal(true);
                    }}
                    size="sm"
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Top Threat Types and Risky IPs */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Threat Types</h3>
            <div className="space-y-3">
              {metrics.topThreatTypes.map((threat, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{threat.type.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-medium text-gray-900">{threat.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Risky IP Addresses</h3>
            <div className="space-y-3">
              {metrics.topRiskyIPs.map((ip, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 font-mono">{ip.ipAddress}</span>
                  <span className="text-sm font-medium text-gray-900">{ip.attempts} attempts</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Resolve Threat Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => {
          setShowResolveModal(false);
          setSelectedThreat(null);
          setResolution('');
        }}
        title="Resolve Security Threat"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Threat Details:</p>
            <p className="text-gray-900">{selectedThreat?.description}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resolution Notes
            </label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Describe how this threat was resolved..."
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowResolveModal(false);
                setSelectedThreat(null);
                setResolution('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolveThreat}
              disabled={!resolution.trim()}
            >
              Resolve Threat
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Restrictions Modal */}
      <Modal
        isOpen={showRestrictionsModal}
        onClose={() => setShowRestrictionsModal(false)}
        title="Add Security Restriction"
      >
        <Form onSubmit={(e) => { e.preventDefault(); handleAddRestriction(); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Restriction Type
              </label>
              <select
                value={restrictionForm.type}
                onChange={(e) => setRestrictionForm(prev => ({ ...prev, type: e.target.value as 'ip' | 'geolocation' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ip">IP Address</option>
                <option value="geolocation">Geolocation</option>
              </select>
            </div>

            {restrictionForm.type === 'ip' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IP Address
                </label>
                <Input
                  type="text"
                  value={restrictionForm.ipAddress}
                  onChange={(e) => setRestrictionForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                  placeholder="192.168.1.1"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country Code
                </label>
                <Input
                  type="text"
                  value={restrictionForm.countryCode}
                  onChange={(e) => setRestrictionForm(prev => ({ ...prev, countryCode: e.target.value }))}
                  placeholder="US"
                  maxLength={2}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action
              </label>
              <select
                value={restrictionForm.restrictionType}
                onChange={(e) => setRestrictionForm(prev => ({ ...prev, restrictionType: e.target.value as 'ALLOW' | 'BLOCK' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="BLOCK">Block</option>
                <option value="ALLOW">Allow</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason
              </label>
              <Input
                type="text"
                value={restrictionForm.reason}
                onChange={(e) => setRestrictionForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for this restriction"
                required
              />
            </div>

            {restrictionForm.type === 'ip' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expires At (Optional)
                </label>
                <Input
                  type="datetime-local"
                  value={restrictionForm.expiresAt}
                  onChange={(e) => setRestrictionForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRestrictionsModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Add Restriction
              </Button>
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
}