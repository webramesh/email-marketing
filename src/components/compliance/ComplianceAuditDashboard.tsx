'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
// Removed Table import since we'll use standard HTML tables

interface AuditLogEntry {
    id: string;
    action: string;
    resource: string;
    resourceId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    changes?: any;
    metadata?: any;
    createdAt: string;
    integrityVerified: boolean;
}

interface ComplianceReport {
    id: string;
    reportType: string;
    startDate: string;
    endDate: string;
    generatedAt: string;
    format: string;
    downloadUrl?: string;
    expiresAt: string;
    summary: {
        totalEvents: number;
        complianceScore: number;
        issues: any[];
    };
}

interface PrivacySettings {
    id: string;
    dataProcessingConsent: boolean;
    marketingConsent: boolean;
    analyticsConsent: boolean;
    thirdPartySharing: boolean;
    dataRetentionPreference: number;
    communicationPreferences: {
        email: boolean;
        sms: boolean;
        push: boolean;
    };
    updatedAt: string;
}

export default function ComplianceAuditDashboard() {
    const [activeTab, setActiveTab] = useState<'audit' | 'reports' | 'privacy' | 'cleanup'>('audit');
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [reports, setReports] = useState<ComplianceReport[]>([]);
    const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Audit log filters
    const [auditFilters, setAuditFilters] = useState({
        userId: '',
        action: '',
        resource: '',
        startDate: '',
        endDate: '',
        riskLevel: '',
    });

    // Modal states
    const [showExportModal, setShowExportModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showCleanupModal, setShowCleanupModal] = useState(false);

    // Export/Delete states
    const [exportUserId, setExportUserId] = useState('');
    const [deleteUserId, setDeleteUserId] = useState('');
    const [confirmationToken, setConfirmationToken] = useState('');

    // Report generation states
    const [reportType, setReportType] = useState('AUDIT_TRAIL');
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportFormat, setReportFormat] = useState('JSON');

    // Cleanup states
    const [retentionDays, setRetentionDays] = useState(2555);
    const [cleanupPreview, setCleanupPreview] = useState<any>(null);

    useEffect(() => {
        if (activeTab === 'audit') {
            fetchAuditLogs();
        } else if (activeTab === 'reports') {
            fetchReports();
        } else if (activeTab === 'privacy') {
            fetchPrivacySettings();
        }
    }, [activeTab]);

    const fetchAuditLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            Object.entries(auditFilters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const response = await fetch(`/api/compliance/audit?${params}`);
            const data = await response.json();

            if (data.success) {
                setAuditLogs(data.data.entries);
            } else {
                setError(data.error || 'Failed to fetch audit logs');
            }
        } catch (err) {
            setError('Failed to fetch audit logs');
        } finally {
            setLoading(false);
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/compliance/reports');
            const data = await response.json();

            if (data.success) {
                setReports(data.data.reports || []);
            } else {
                setError(data.error || 'Failed to fetch reports');
            }
        } catch (err) {
            setError('Failed to fetch reports');
        } finally {
            setLoading(false);
        }
    };

    const fetchPrivacySettings = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/compliance/privacy-settings');
            const data = await response.json();

            if (data.success) {
                setPrivacySettings(data.data);
            } else {
                setError(data.error || 'Failed to fetch privacy settings');
            }
        } catch (err) {
            setError('Failed to fetch privacy settings');
        } finally {
            setLoading(false);
        }
    };

    const handleExportUserData = async () => {
        if (!exportUserId) return;

        setLoading(true);
        try {
            const response = await fetch('/api/compliance/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: exportUserId,
                    format: 'JSON',
                }),
            });

            const data = await response.json();

            if (data.success) {
                alert(`Export initiated successfully. Download URL: ${data.data.downloadUrl}`);
                setShowExportModal(false);
                setExportUserId('');
            } else {
                setError(data.error || 'Failed to export user data');
            }
        } catch (err) {
            setError('Failed to export user data');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUserData = async () => {
        if (!deleteUserId || !confirmationToken) return;

        setLoading(true);
        try {
            const response = await fetch('/api/compliance/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: deleteUserId,
                    confirmationToken,
                    options: {
                        anonymize: true,
                        hardDelete: false,
                        retainAuditLogs: true,
                    },
                }),
            });

            const data = await response.json();

            if (data.success) {
                alert(`User data deletion completed. ${data.data.anonymizedRecords} records anonymized.`);
                setShowDeleteModal(false);
                setDeleteUserId('');
                setConfirmationToken('');
            } else {
                setError(data.error || 'Failed to delete user data');
            }
        } catch (err) {
            setError('Failed to delete user data');
        } finally {
            setLoading(false);
        }
    };

    const generateConfirmationToken = async () => {
        if (!deleteUserId) return;

        try {
            const response = await fetch(`/api/compliance/delete?userId=${deleteUserId}`);
            const data = await response.json();

            if (data.success) {
                setConfirmationToken(data.confirmationToken);
            } else {
                setError(data.error || 'Failed to generate confirmation token');
            }
        } catch (err) {
            setError('Failed to generate confirmation token');
        }
    };

    const handleGenerateReport = async () => {
        if (!reportStartDate || !reportEndDate) return;

        setLoading(true);
        try {
            const response = await fetch('/api/compliance/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportType,
                    startDate: new Date(reportStartDate).toISOString(),
                    endDate: new Date(reportEndDate).toISOString(),
                    format: reportFormat,
                }),
            });

            const data = await response.json();

            if (data.success) {
                alert(`Report generated successfully. Download URL: ${data.data.downloadUrl}`);
                setShowReportModal(false);
                fetchReports();
            } else {
                setError(data.error || 'Failed to generate report');
            }
        } catch (err) {
            setError('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleCleanupPreview = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/compliance/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    retentionDays,
                    dryRun: true,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setCleanupPreview(data.data);
            } else {
                setError(data.error || 'Failed to preview cleanup');
            }
        } catch (err) {
            setError('Failed to preview cleanup');
        } finally {
            setLoading(false);
        }
    };

    const handleCleanupExecute = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/compliance/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    retentionDays,
                    dryRun: false,
                }),
            });

            const data = await response.json();

            if (data.success) {
                alert(`Cleanup completed. ${data.data.deletedCount} records deleted, ${data.data.anonymizedCount} records anonymized.`);
                setShowCleanupModal(false);
                setCleanupPreview(null);
            } else {
                setError(data.error || 'Failed to execute cleanup');
            }
        } catch (err) {
            setError('Failed to execute cleanup');
        } finally {
            setLoading(false);
        }
    };

    const updatePrivacySettings = async (updates: Partial<PrivacySettings>) => {
        setLoading(true);
        try {
            const response = await fetch('/api/compliance/privacy-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            const data = await response.json();

            if (data.success) {
                setPrivacySettings(data.data);
                alert('Privacy settings updated successfully');
            } else {
                setError(data.error || 'Failed to update privacy settings');
            }
        } catch (err) {
            setError('Failed to update privacy settings');
        } finally {
            setLoading(false);
        }
    };

    const getRiskLevelColor = (riskLevel: string) => {
        switch (riskLevel) {
            case 'LOW': return 'bg-green-100 text-green-800';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
            case 'HIGH': return 'bg-orange-100 text-orange-800';
            case 'CRITICAL': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Compliance & Audit Dashboard</h1>
                <p className="text-gray-600 mt-2">
                    Manage audit logs, compliance reports, privacy settings, and data retention
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                    <Button
                        onClick={() => setError(null)}
                        className="mt-2 text-sm"
                        variant="outline"
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'audit', label: 'Audit Logs' },
                        { id: 'reports', label: 'Compliance Reports' },
                        { id: 'privacy', label: 'Privacy Settings' },
                        { id: 'cleanup', label: 'Data Cleanup' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Audit Logs Tab */}
            {activeTab === 'audit' && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold mb-4">Audit Log Filters</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                placeholder="User ID"
                                value={auditFilters.userId}
                                onChange={(e) => setAuditFilters({ ...auditFilters, userId: e.target.value })}
                            />
                            <Input
                                placeholder="Action"
                                value={auditFilters.action}
                                onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                            />
                            <Input
                                placeholder="Resource"
                                value={auditFilters.resource}
                                onChange={(e) => setAuditFilters({ ...auditFilters, resource: e.target.value })}
                            />
                            <Input
                                type="date"
                                placeholder="Start Date"
                                value={auditFilters.startDate}
                                onChange={(e) => setAuditFilters({ ...auditFilters, startDate: e.target.value })}
                            />
                            <Input
                                type="date"
                                placeholder="End Date"
                                value={auditFilters.endDate}
                                onChange={(e) => setAuditFilters({ ...auditFilters, endDate: e.target.value })}
                            />
                            <select
                                className="px-3 py-2 border border-gray-300 rounded-md"
                                value={auditFilters.riskLevel}
                                onChange={(e) => setAuditFilters({ ...auditFilters, riskLevel: e.target.value })}
                            >
                                <option value="">All Risk Levels</option>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="CRITICAL">Critical</option>
                            </select>
                        </div>
                        <div className="mt-4 flex space-x-2">
                            <Button onClick={fetchAuditLogs} disabled={loading}>
                                {loading ? 'Loading...' : 'Search'}
                            </Button>
                            <Button
                                onClick={() => setAuditFilters({
                                    userId: '', action: '', resource: '', startDate: '', endDate: '', riskLevel: ''
                                })}
                                variant="outline"
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Audit Log Entries</h2>
                            <div className="space-x-2">
                                <Button onClick={() => setShowExportModal(true)} variant="outline">
                                    Export User Data
                                </Button>
                                <Button onClick={() => setShowDeleteModal(true)} variant="outline">
                                    Delete User Data
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Integrity</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {auditLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(log.createdAt).toLocaleString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.action}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.resource}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.userId || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge className={getRiskLevelColor(log.metadata?.riskLevel || 'LOW')}>
                                                    {log.metadata?.riskLevel || 'LOW'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge className={log.integrityVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                                    {log.integrityVerified ? 'Verified' : 'Failed'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.ipAddress || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* Compliance Reports Tab */}
            {activeTab === 'reports' && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Compliance Reports</h2>
                            <Button onClick={() => setShowReportModal(true)}>
                                Generate New Report
                            </Button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Format</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance Score</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.reportType}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(report.generatedAt).toLocaleString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.format}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge className={report.summary.complianceScore >= 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                                    {report.summary.complianceScore}%
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                {report.downloadUrl && (
                                                    <Button
                                                        onClick={() => window.open(report.downloadUrl, '_blank')}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        Download
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* Privacy Settings Tab */}
            {activeTab === 'privacy' && privacySettings && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold mb-4">Privacy Settings</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">Data Processing Consent</h3>
                                    <p className="text-sm text-gray-600">Allow processing of personal data</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={privacySettings.dataProcessingConsent}
                                    onChange={(e) => updatePrivacySettings({ dataProcessingConsent: e.target.checked })}
                                    className="h-4 w-4 text-blue-600"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">Marketing Consent</h3>
                                    <p className="text-sm text-gray-600">Allow marketing communications</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={privacySettings.marketingConsent}
                                    onChange={(e) => updatePrivacySettings({ marketingConsent: e.target.checked })}
                                    className="h-4 w-4 text-blue-600"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">Analytics Consent</h3>
                                    <p className="text-sm text-gray-600">Allow analytics tracking</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={privacySettings.analyticsConsent}
                                    onChange={(e) => updatePrivacySettings({ analyticsConsent: e.target.checked })}
                                    className="h-4 w-4 text-blue-600"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">Third Party Sharing</h3>
                                    <p className="text-sm text-gray-600">Allow sharing data with third parties</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={privacySettings.thirdPartySharing}
                                    onChange={(e) => updatePrivacySettings({ thirdPartySharing: e.target.checked })}
                                    className="h-4 w-4 text-blue-600"
                                />
                            </div>

                            <div>
                                <h3 className="font-medium mb-2">Data Retention Preference</h3>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="range"
                                        min="30"
                                        max="3650"
                                        value={privacySettings.dataRetentionPreference}
                                        onChange={(e) => updatePrivacySettings({ dataRetentionPreference: parseInt(e.target.value) })}
                                        className="flex-1"
                                    />
                                    <span className="text-sm text-gray-600">
                                        {Math.round(privacySettings.dataRetentionPreference / 365)} years
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Data Cleanup Tab */}
            {activeTab === 'cleanup' && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Data Cleanup & Retention</h2>
                            <Button onClick={() => setShowCleanupModal(true)}>
                                Configure Cleanup
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="font-medium text-blue-900">Low Risk Retention</h3>
                                <p className="text-2xl font-bold text-blue-600">3 Years</p>
                                <p className="text-sm text-blue-700">Suitable for most compliance requirements</p>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg">
                                <h3 className="font-medium text-yellow-900">Medium Risk Retention</h3>
                                <p className="text-2xl font-bold text-yellow-600">7 Years</p>
                                <p className="text-sm text-yellow-700">Recommended for financial sectors</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg">
                                <h3 className="font-medium text-red-900">High Risk Retention</h3>
                                <p className="text-2xl font-bold text-red-600">10 Years</p>
                                <p className="text-sm text-red-700">Maximum retention for regulated industries</p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Export Modal */}
            <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Export User Data</h3>
                    <div className="space-y-4">
                        <Input
                            placeholder="User ID"
                            value={exportUserId}
                            onChange={(e) => setExportUserId(e.target.value)}
                        />
                        <div className="flex space-x-2">
                            <Button onClick={handleExportUserData} disabled={loading || !exportUserId}>
                                {loading ? 'Exporting...' : 'Export Data'}
                            </Button>
                            <Button onClick={() => setShowExportModal(false)} variant="outline">
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Delete User Data</h3>
                    <div className="space-y-4">
                        <Input
                            placeholder="User ID"
                            value={deleteUserId}
                            onChange={(e) => setDeleteUserId(e.target.value)}
                        />
                        <div className="flex space-x-2">
                            <Button onClick={generateConfirmationToken} disabled={!deleteUserId} variant="outline">
                                Generate Token
                            </Button>
                        </div>
                        {confirmationToken && (
                            <Input
                                placeholder="Confirmation Token"
                                value={confirmationToken}
                                readOnly
                            />
                        )}
                        <div className="flex space-x-2">
                            <Button
                                onClick={handleDeleteUserData}
                                disabled={loading || !deleteUserId || !confirmationToken}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {loading ? 'Deleting...' : 'Delete Data'}
                            </Button>
                            <Button onClick={() => setShowDeleteModal(false)} variant="outline">
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Report Generation Modal */}
            <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Generate Compliance Report</h3>
                    <div className="space-y-4">
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                        >
                            <option value="AUDIT_TRAIL">Audit Trail</option>
                            <option value="GDPR_COMPLIANCE">GDPR Compliance</option>
                            <option value="DATA_PROCESSING">Data Processing</option>
                            <option value="CONSENT_MANAGEMENT">Consent Management</option>
                            <option value="SECURITY_EVENTS">Security Events</option>
                            <option value="USER_ACTIVITY">User Activity</option>
                            <option value="DATA_RETENTION">Data Retention</option>
                        </select>
                        <Input
                            type="date"
                            placeholder="Start Date"
                            value={reportStartDate}
                            onChange={(e) => setReportStartDate(e.target.value)}
                        />
                        <Input
                            type="date"
                            placeholder="End Date"
                            value={reportEndDate}
                            onChange={(e) => setReportEndDate(e.target.value)}
                        />
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={reportFormat}
                            onChange={(e) => setReportFormat(e.target.value)}
                        >
                            <option value="JSON">JSON</option>
                            <option value="CSV">CSV</option>
                            <option value="PDF">PDF</option>
                        </select>
                        <div className="flex space-x-2">
                            <Button
                                onClick={handleGenerateReport}
                                disabled={loading || !reportStartDate || !reportEndDate}
                            >
                                {loading ? 'Generating...' : 'Generate Report'}
                            </Button>
                            <Button onClick={() => setShowReportModal(false)} variant="outline">
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Cleanup Modal */}
            <Modal isOpen={showCleanupModal} onClose={() => setShowCleanupModal(false)}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Data Cleanup Configuration</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Retention Period (Days)</label>
                            <Input
                                type="number"
                                min="30"
                                max="3650"
                                value={retentionDays}
                                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                            />
                            <p className="text-sm text-gray-600 mt-1">
                                {Math.round(retentionDays / 365)} years retention period
                            </p>
                        </div>

                        <div className="flex space-x-2">
                            <Button onClick={handleCleanupPreview} disabled={loading}>
                                {loading ? 'Loading...' : 'Preview Cleanup'}
                            </Button>
                        </div>

                        {cleanupPreview && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Cleanup Preview</h4>
                                <div className="space-y-2 text-sm">
                                    <p>Total old logs: {cleanupPreview.totalOldLogs}</p>
                                    <p>Critical logs to anonymize: {cleanupPreview.criticalLogsToAnonymize}</p>
                                    <p>Regular logs to delete: {cleanupPreview.regularLogsToDelete}</p>
                                    <p>Estimated space saved: {cleanupPreview.estimatedSpaceSaved}</p>
                                </div>
                                <Button
                                    onClick={handleCleanupExecute}
                                    disabled={loading}
                                    className="mt-4 bg-red-600 hover:bg-red-700"
                                >
                                    {loading ? 'Executing...' : 'Execute Cleanup'}
                                </Button>
                            </div>
                        )}

                        <Button onClick={() => setShowCleanupModal(false)} variant="outline">
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}