'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

interface Package {
    id: string;
    packageId: string;
    name: string;
    tier: string;
    status: string;
    expiresAt: string;
    features: Record<string, any>;
    quotas: Record<string, number>;
    usage: Record<string, number>;
}

interface UserPermissions {
    packages: Package[];
    features: Record<string, any>;
    quotas: Record<string, number>;
    usage: Record<string, number>;
    restrictions: string[];
}

interface PackageTemplate {
    id: string;
    name: string;
    description: string;
    tier: string;
    features: Record<string, any>;
    quotas: Record<string, number>;
}

interface PackagePermissionManagerProps {
    userId?: string;
    onPermissionsChange?: () => void;
}

export function PackagePermissionManager({
    userId,
    onPermissionsChange
}: PackagePermissionManagerProps) {
    const [permissions, setPermissions] = useState<UserPermissions | null>(null);
    const [templates, setTemplates] = useState<PackageTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

    useEffect(() => {
        loadPermissions();
        loadTemplates();
    }, [userId]);

    const loadPermissions = async () => {
        try {
            const params = userId ? `?userId=${userId}` : '';
            const response = await fetch(`/api/permissions/packages${params}`);
            const data = await response.json();

            if (response.ok) {
                setPermissions(data.permissions);
            }
        } catch (error) {
            console.error('Error loading permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTemplates = async () => {
        try {
            const response = await fetch('/api/permissions/packages?action=templates');
            const data = await response.json();

            if (response.ok) {
                setTemplates(data.templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    };

    const handleAssignPackage = async (packageId: string, customFeatures?: Record<string, any>) => {
        try {
            const response = await fetch('/api/permissions/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assign',
                    userId: userId || 'current',
                    packageId,
                    customFeatures,
                    reason: 'Manual assignment via admin interface'
                })
            });

            if (response.ok) {
                await loadPermissions();
                setShowAssignModal(false);
                onPermissionsChange?.();
            }
        } catch (error) {
            console.error('Error assigning package:', error);
        }
    };

    const handleRemovePackage = async (packageId: string) => {
        if (!confirm('Are you sure you want to remove this package?')) return;

        try {
            const response = await fetch(
                `/api/permissions/packages?userId=${userId || 'current'}&packageId=${packageId}&reason=Manual removal via admin interface`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                await loadPermissions();
                onPermissionsChange?.();
            }
        } catch (error) {
            console.error('Error removing package:', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'trialing': return 'bg-blue-100 text-blue-800';
            case 'expired': return 'bg-red-100 text-red-800';
            case 'suspended': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getTierColor = (tier: string) => {
        switch (tier.toLowerCase()) {
            case 'basic': return 'bg-gray-100 text-gray-800';
            case 'standard': return 'bg-blue-100 text-blue-800';
            case 'professional': return 'bg-purple-100 text-purple-800';
            case 'enterprise': return 'bg-indigo-100 text-indigo-800';
            case 'unlimited': return 'bg-gold-100 text-gold-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const calculateUsagePercentage = (used: number, limit: number) => {
        if (limit === 0) return 0;
        return Math.min((used / limit) * 100, 100);
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Current Packages */}
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Active Packages</h3>
                    <Button onClick={() => setShowAssignModal(true)}>
                        Assign Package
                    </Button>
                </div>

                {permissions?.packages.length === 0 ? (
                    <p className="text-gray-500">No packages assigned</p>
                ) : (
                    <div className="space-y-4">
                        {permissions?.packages.map((pkg) => (
                            <div key={pkg.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-medium">{pkg.name}</h4>
                                        <div className="flex gap-2 mt-1">
                                            <Badge className={getTierColor(pkg.tier)}>
                                                {pkg.tier}
                                            </Badge>
                                            <Badge className={getStatusColor(pkg.status)}>
                                                {pkg.status}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedPackage(pkg);
                                                setShowPermissionModal(true);
                                            }}
                                        >
                                            View Details
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRemovePackage(pkg.packageId)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>

                                <div className="text-sm text-gray-600">
                                    Expires: {new Date(pkg.expiresAt).toLocaleDateString()}
                                </div>

                                {/* Quota Usage */}
                                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {Object.entries(pkg.quotas).map(([key, limit]) => {
                                        const used = pkg.usage[key] || 0;
                                        const percentage = calculateUsagePercentage(used, limit);

                                        return (
                                            <div key={key} className="text-sm">
                                                <div className="flex justify-between mb-1">
                                                    <span className="capitalize">{key.replace('_', ' ')}</span>
                                                    <span>{used}/{limit}</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full ${percentage > 90 ? 'bg-red-500' :
                                                            percentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                                                            }`}
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Feature Summary */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Available Features</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {permissions && Object.entries(permissions.features).map(([key, enabled]) => (
                        <div
                            key={key}
                            className={`p-3 rounded-lg border ${enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-400'
                                        }`}
                                ></div>
                                <span className="text-sm capitalize">
                                    {key.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Restrictions */}
            {permissions?.restrictions && permissions.restrictions.length > 0 && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Current Restrictions</h3>
                    <div className="space-y-2">
                        {permissions.restrictions.map((restriction, index) => (
                            <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">{restriction}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Assign Package Modal */}
            <Modal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                title="Assign Package"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Select a package template to assign to the user:
                    </p>

                    <div className="space-y-3">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleAssignPackage(template.id)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-medium">{template.name}</h4>
                                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                                        <Badge className={getTierColor(template.tier)} size="sm">
                                            {template.tier}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Package Details Modal */}
            <Modal
                isOpen={showPermissionModal}
                onClose={() => setShowPermissionModal(false)}
                title={`Package Details: ${selectedPackage?.name}`}
            >
                {selectedPackage && (
                    <div className="space-y-6">
                        {/* Package Info */}
                        <div>
                            <h4 className="font-medium mb-2">Package Information</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-600">Tier:</span>
                                    <Badge className={getTierColor(selectedPackage.tier)} size="sm">
                                        {selectedPackage.tier}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-gray-600">Status:</span>
                                    <Badge className={getStatusColor(selectedPackage.status)} size="sm">
                                        {selectedPackage.status}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-gray-600">Expires:</span>
                                    <span className="ml-2">{new Date(selectedPackage.expiresAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Features */}
                        <div>
                            <h4 className="font-medium mb-2">Features</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(selectedPackage.features).map(([key, enabled]) => (
                                    <div key={key} className="flex items-center gap-2 text-sm">
                                        <div
                                            className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-400'
                                                }`}
                                        ></div>
                                        <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quotas and Usage */}
                        <div>
                            <h4 className="font-medium mb-2">Quotas & Usage</h4>
                            <div className="space-y-3">
                                {Object.entries(selectedPackage.quotas).map(([key, limit]) => {
                                    const used = selectedPackage.usage[key] || 0;
                                    const percentage = calculateUsagePercentage(used, limit);

                                    return (
                                        <div key={key}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="capitalize">{key.replace('_', ' ')}</span>
                                                <span>{used} / {limit}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${percentage > 90 ? 'bg-red-500' :
                                                        percentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`}
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}