'use client'

import { Card } from '@/components/ui/Card'

interface SubscriberStatsProps {
  stats?: {
    total: number
    active: number
    unsubscribed: number
    bounced: number
    complained: number
    invalid: number
  } | null
}

export function SubscriberStats({ stats }: SubscriberStatsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    )
  }

  const statItems = [
    {
      label: 'Total Subscribers',
      value: stats.total,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Active',
      value: stats.active,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Unsubscribed',
      value: stats.unsubscribed,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    },
    {
      label: 'Bounced',
      value: stats.bounced,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      label: 'Complained',
      value: stats.complained,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      label: 'Invalid',
      value: stats.invalid,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statItems.map((item) => (
        <Card key={item.label} className={`p-4 ${item.bgColor}`}>
          <div className="text-sm font-medium text-gray-600 mb-1">
            {item.label}
          </div>
          <div className={`text-2xl font-bold ${item.color}`}>
            {item.value.toLocaleString()}
          </div>
        </Card>
      ))}
    </div>
  )
}