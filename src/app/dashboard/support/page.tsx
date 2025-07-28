'use client';

import React, { useState, useEffect } from 'react';
import { SupportTicketList } from '@/components/support/SupportTicketList';
import { SupportTicketDetail } from '@/components/support/SupportTicketDetail';
import { CreateTicketForm } from '@/components/support/CreateTicketForm';
import { Card } from '@/components/ui/Card';
import { SupportTicket } from '@/generated/prisma';
import {
  DocumentTextIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface TicketStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  urgentTickets: number;
  overdueTickets: number;
  activeTickets: number;
}

interface TicketWithDetails extends SupportTicket {
  assignedToUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  requesterUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  _count?: {
    comments: number;
    attachments: number;
  };
}

export default function SupportPage() {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/support/tickets/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const handleTicketSelect = (ticket: TicketWithDetails) => {
    setSelectedTicketId(ticket.id);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedTicketId(null);
  };

  const handleCreateSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const statCards = [
    {
      title: 'Total Tickets',
      value: stats?.totalTickets || 0,
      icon: DocumentTextIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Tickets',
      value: stats?.activeTickets || 0,
      icon: ClockIcon,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Urgent Tickets',
      value: stats?.urgentTickets || 0,
      icon: ExclamationTriangleIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Overdue Tickets',
      value: stats?.overdueTickets || 0,
      icon: XCircleIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Resolved Today',
      value: stats?.resolvedTickets || 0,
      icon: CheckCircleIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title} className="p-4">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Tickets List */}
          <SupportTicketList
            onTicketSelect={handleTicketSelect}
            onCreateTicket={() => setShowCreateForm(true)}
          />
        </>
      )}

      {view === 'detail' && selectedTicketId && (
        <SupportTicketDetail
          ticketId={selectedTicketId}
          onBack={handleBackToList}
        />
      )}

      {/* Create Ticket Modal */}
      <CreateTicketForm
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}