import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

/**
 * Dashboard page component
 */
export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome to your email marketing dashboard"
        actions={<Button>Create Campaign</Button>}
      />

      {/* Stats overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total Subscribers" value="12,345" change="+12%" changeType="positive" />
        <StatCard title="Open Rate" value="24.8%" change="+3.2%" changeType="positive" />
        <StatCard title="Click Rate" value="4.3%" change="-0.5%" changeType="negative" />
        <StatCard title="Campaigns Sent" value="48" change="+8" changeType="positive" />
      </div>

      {/* Recent campaigns */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>Your most recent email campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200">
                  <th className="py-3 text-left font-medium text-secondary-500">Name</th>
                  <th className="py-3 text-left font-medium text-secondary-500">Status</th>
                  <th className="py-3 text-left font-medium text-secondary-500">Recipients</th>
                  <th className="py-3 text-left font-medium text-secondary-500">Open Rate</th>
                  <th className="py-3 text-left font-medium text-secondary-500">Click Rate</th>
                  <th className="py-3 text-left font-medium text-secondary-500">Sent Date</th>
                </tr>
              </thead>
              <tbody>
                <CampaignRow
                  name="Monthly Newsletter"
                  status="sent"
                  recipients="8,546"
                  openRate="32.4%"
                  clickRate="5.7%"
                  sentDate="Jul 15, 2025"
                />
                <CampaignRow
                  name="Product Launch"
                  status="sent"
                  recipients="12,103"
                  openRate="41.2%"
                  clickRate="8.3%"
                  sentDate="Jul 10, 2025"
                />
                <CampaignRow
                  name="Summer Sale"
                  status="draft"
                  recipients="--"
                  openRate="--"
                  clickRate="--"
                  sentDate="--"
                />
                <CampaignRow
                  name="Customer Survey"
                  status="scheduled"
                  recipients="5,230"
                  openRate="--"
                  clickRate="--"
                  sentDate="Jul 20, 2025"
                />
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-center">
            <Button variant="outline">View All Campaigns</Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscriber growth */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscriber Growth</CardTitle>
            <CardDescription>New subscribers over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-secondary-50 rounded-md">
              <p className="text-secondary-500">Chart placeholder</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Content</CardTitle>
            <CardDescription>Content with highest engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ContentItem
                title="10 Email Marketing Tips for 2025"
                openRate="48.2%"
                clickRate="12.5%"
              />
              <ContentItem
                title="Introducing Our New Product Line"
                openRate="45.7%"
                clickRate="10.3%"
              />
              <ContentItem
                title="Customer Success Story: Acme Inc"
                openRate="42.1%"
                clickRate="9.8%"
              />
              <ContentItem
                title="Summer Sale: 30% Off Everything"
                openRate="39.5%"
                clickRate="15.2%"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

function StatCard({ title, value, change, changeType }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-secondary-500">{title}</p>
          <Badge
            variant={
              changeType === 'positive'
                ? 'success'
                : changeType === 'negative'
                ? 'error'
                : 'default'
            }
            size="sm"
          >
            {change}
          </Badge>
        </div>
        <p className="mt-2 text-3xl font-semibold text-secondary-900">{value}</p>
      </CardContent>
    </Card>
  );
}

interface CampaignRowProps {
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  recipients: string;
  openRate: string;
  clickRate: string;
  sentDate: string;
}

function CampaignRow({
  name,
  status,
  recipients,
  openRate,
  clickRate,
  sentDate,
}: CampaignRowProps) {
  const statusVariant: Record<
    CampaignRowProps['status'],
    'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'outline'
  > = {
    draft: 'default',
    scheduled: 'primary',
    sending: 'accent',
    sent: 'success',
    failed: 'error',
  };

  const statusLabel = {
    draft: 'Draft',
    scheduled: 'Scheduled',
    sending: 'Sending',
    sent: 'Sent',
    failed: 'Failed',
  };

  return (
    <tr className="border-b border-secondary-200">
      <td className="py-3 font-medium text-secondary-900">{name}</td>
      <td className="py-3">
        <Badge variant={statusVariant[status]} size="sm">
          {statusLabel[status]}
        </Badge>
      </td>
      <td className="py-3">{recipients}</td>
      <td className="py-3">{openRate}</td>
      <td className="py-3">{clickRate}</td>
      <td className="py-3">{sentDate}</td>
    </tr>
  );
}

interface ContentItemProps {
  title: string;
  openRate: string;
  clickRate: string;
}

function ContentItem({ title, openRate, clickRate }: ContentItemProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md hover:bg-secondary-50">
      <div className="flex-1">
        <p className="font-medium text-secondary-900">{title}</p>
      </div>
      <div className="flex space-x-4 text-sm">
        <div>
          <span className="text-secondary-500">Opens:</span>{' '}
          <span className="font-medium">{openRate}</span>
        </div>
        <div>
          <span className="text-secondary-500">Clicks:</span>{' '}
          <span className="font-medium">{clickRate}</span>
        </div>
      </div>
    </div>
  );
}
