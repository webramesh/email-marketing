'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormAnalyticsService, FormAnalyticsData, ConversionFunnelData } from '@/services/form-analytics.service';

interface FormAnalyticsDashboardProps {
    formId: string;
    tenantId: string;
}

export function FormAnalyticsDashboard({ formId, tenantId }: FormAnalyticsDashboardProps) {
    const [analytics, setAnalytics] = useState<FormAnalyticsData[]>([]);
    const [funnelData, setFunnelData] = useState<ConversionFunnelData[]>([]);
    const [insights, setInsights] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

    useEffect(() => {
        fetchAnalytics();
    }, [formId, dateRange]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);

            const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;

            const [analyticsResponse, funnelResponse, insightsResponse] = await Promise.all([
                fetch(`/api/forms/${formId}/analytics?type=overview&days=${days}`),
                fetch(`/api/forms/${formId}/analytics?type=funnel&days=${days}`),
                fetch(`/api/forms/${formId}/analytics?type=insights&days=${days}`),
            ]);

            const [analyticsData, funnelData, insightsData] = await Promise.all([
                analyticsResponse.json(),
                funnelResponse.json(),
                insightsResponse.json(),
            ]);

            setAnalytics(analyticsData.data || []);
            setFunnelData(funnelData.data || []);
            setInsights(insightsData.data || null);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalViews = analytics.reduce((sum, record) => sum + record.views, 0);
    const totalSubmissions = analytics.reduce((sum, record) => sum + record.submissions, 0);
    const avgConversionRate = analytics.length > 0
        ? analytics.reduce((sum, record) => sum + record.conversionRate, 0) / analytics.length
        : 0;

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader>
                                <div className="h-4 bg-secondary-200 rounded w-1/2"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 bg-secondary-200 rounded w-3/4"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-secondary-900">Form Analytics</h3>
                <div className="flex items-center space-x-2">
                    {['7d', '30d', '90d'].map(range => (
                        <Button
                            key={range}
                            size="sm"
                            variant={dateRange === range ? 'primary' : 'outline'}
                            onClick={() => setDateRange(range as any)}
                        >
                            {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-secondary-600">Total Views</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-secondary-900">
                            {totalViews.toLocaleString()}
                        </div>
                        <p className="text-xs text-secondary-500 mt-1">
                            Form impressions in selected period
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-secondary-600">Total Submissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-secondary-900">
                            {totalSubmissions.toLocaleString()}
                        </div>
                        <p className="text-xs text-secondary-500 mt-1">
                            Successful form submissions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-secondary-600">Conversion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-secondary-900">
                            {avgConversionRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-secondary-500 mt-1">
                            Average conversion rate
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Conversion Funnel */}
            {funnelData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Conversion Funnel</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {funnelData.map((step, index) => (
                                <div key={step.step} className="flex items-center space-x-4">
                                    <div className="w-24 text-sm font-medium text-secondary-700">
                                        {step.step}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-secondary-600">
                                                {step.visitors.toLocaleString()} visitors
                                            </span>
                                            {index > 0 && (
                                                <span className="text-sm text-red-600">
                                                    -{step.dropoffRate.toFixed(1)}% dropoff
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-full bg-secondary-200 rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${index === 0 ? 100 : (step.visitors / funnelData[0].visitors) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Performance Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Performance Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-end justify-between space-x-1">
                        {analytics.map((record, index) => {
                            const maxViews = Math.max(...analytics.map(r => r.views));
                            const height = maxViews > 0 ? (record.views / maxViews) * 100 : 0;

                            return (
                                <div key={index} className="flex-1 flex flex-col items-center">
                                    <div
                                        className="w-full bg-primary rounded-t transition-all duration-300 hover:bg-primary-600"
                                        style={{ height: `${height}%`, minHeight: '2px' }}
                                        title={`${record.date.toLocaleDateString()}: ${record.views} views, ${record.submissions} submissions`}
                                    />
                                    <div className="text-xs text-secondary-500 mt-1 transform -rotate-45 origin-left">
                                        {record.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Insights and Recommendations */}
            {insights && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Insights */}
                    {insights.insights.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Insights</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {insights.insights.map((insight: any, index: number) => (
                                    <div
                                        key={index}
                                        className={`p-3 rounded-lg border-l-4 ${insight.type === 'success'
                                            ? 'bg-green-50 border-green-400'
                                            : insight.type === 'warning'
                                                ? 'bg-yellow-50 border-yellow-400'
                                                : 'bg-blue-50 border-blue-400'
                                            }`}
                                    >
                                        <h4 className="font-medium text-secondary-900">{insight.title}</h4>
                                        <p className="text-sm text-secondary-600 mt-1">{insight.description}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Recommendations */}
                    {insights.recommendations.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Recommendations</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {insights.recommendations.map((rec: any, index: number) => (
                                    <div key={index} className="p-3 bg-secondary-50 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <h4 className="font-medium text-secondary-900">{rec.title}</h4>
                                            <span
                                                className={`px-2 py-1 text-xs rounded-full ${rec.priority === 'high'
                                                    ? 'bg-red-100 text-red-800'
                                                    : rec.priority === 'medium'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-green-100 text-green-800'
                                                    }`}
                                            >
                                                {rec.priority}
                                            </span>
                                        </div>
                                        <p className="text-sm text-secondary-600 mt-1">{rec.description}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}