'use client';

import React, { useState, useEffect } from 'react';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SupportTicket
} from '@/generated/prisma';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Dropdown } from '@/components/ui/Dropdown';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  EllipsisVerticalIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

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

interface TicketFilters {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  category?: TicketCategory[];
  assignedToUserId?: string;
  assignedCompany?: string;
  search?: string;
}

interface SupportTicketListProps {
  onTicketSelect?: (ticket: TicketWithDetails) => void;
  onCreateTicket?: () => void;
}

const priorityColors = {
  [TicketPriority.LOW]: 'bg-gray-100 text-gray-800',
  [TicketPriority.MEDIUM]: 'bg-blue-100 text-blue-800',
  [TicketPriority.HIGH]: 'bg-orange-100 text-orange-800',
  [TicketPriority.URGENT]: 'bg-red-100 text-red-800',
};

const statusColors = {
  [TicketStatus.OPEN]: 'bg-green-100 text-green-800',
  [TicketStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [TicketStatus.RESOLVED]: 'bg-blue-100 text-blue-800',
  [TicketStatus.CLOSED]: 'bg-gray-100 text-gray-800',
};

const statusIcons = {
  [TicketStatus.OPEN]: ClockIcon,
  [TicketStatus.IN_PROGRESS]: ExclamationTriangleIcon,
  [TicketStatus.RESOLVED]: CheckCircleIcon,
  [TicketStatus.CLOSED]: XCircleIcon,
};

export function SupportTicketList({ onTicketSelect, onCreateTicket }: SupportTicketListProps) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TicketFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.status?.length) {
        params.append('status', filters.status.join(','));
      }
      if (filters.priority?.length) {
        params.append('priority', filters.priority.join(','));
      }
      if (filters.category?.length) {
        params.append('category', filters.category.join(','));
      }
      if (filters.assignedToUserId) {
        params.append('assignedToUserId', filters.assignedToUserId);
      }
      if (filters.assignedCompany) {
        params.append('assignedCompany', filters.assignedCompany);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/support/tickets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tickets');

      const data = await response.json();
      setTickets(data.tickets);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filters, searchTerm, pagination.page]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (newFilters: Partial<TicketFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleBulkUpdate = async (updates: any) => {
    if (selectedTickets.length === 0) return;

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketIds: selectedTickets,
          updates,
        }),
      });

      if (!response.ok) throw new Error('Failed to update tickets');

      setSelectedTickets([]);
      fetchTickets();
    } catch (error) {
      console.error('Error updating tickets:', error);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOverdue = (dueDate: string | Date | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and track customer support requests
          </p>
        </div>
        <Button onClick={onCreateTicket} className="flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <FunnelIcon className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                multiple
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.status || []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value) as TicketStatus[];
                  handleFilterChange({ status: values });
                }}
              >
                {Object.values(TicketStatus).map(status => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                multiple
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.priority || []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value) as TicketPriority[];
                  handleFilterChange({ priority: values });
                }}
              >
                {Object.values(TicketPriority).map(priority => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                multiple
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.category || []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value) as TicketCategory[];
                  handleFilterChange({ category: values });
                }}
              >
                {Object.values(TicketCategory).map(category => (
                  <option key={category} value={category}>
                    {category.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({})}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Bulk Actions */}
      {selectedTickets.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedTickets.length} ticket(s) selected
            </span>
            <div className="flex items-center gap-2">
              <Dropdown
                trigger={
                  <Button variant="outline" size="sm">
                    Bulk Actions
                  </Button>
                }
                items={[
                  {
                    label: 'Mark as In Progress',
                    onClick: () => handleBulkUpdate({ status: TicketStatus.IN_PROGRESS }),
                  },
                  {
                    label: 'Mark as Resolved',
                    onClick: () => handleBulkUpdate({ status: TicketStatus.RESOLVED }),
                  },
                  {
                    label: 'Mark as Closed',
                    onClick: () => handleBulkUpdate({ status: TicketStatus.CLOSED }),
                  },
                  {
                    label: 'Set High Priority',
                    onClick: () => handleBulkUpdate({ priority: TicketPriority.HIGH }),
                  },
                  {
                    label: 'Set Medium Priority',
                    onClick: () => handleBulkUpdate({ priority: TicketPriority.MEDIUM }),
                  },
                ]}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTickets([])}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tickets List */}
      <div className="space-y-4">
        {tickets.map((ticket) => {
          const StatusIcon = statusIcons[ticket.status];
          const isTicketOverdue = isOverdue(ticket.dueDate);

          return (
            <Card
              key={ticket.id}
              className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${selectedTickets.includes(ticket.id) ? 'ring-2 ring-primary-500' : ''
                } ${isTicketOverdue ? 'border-l-4 border-l-red-500' : ''}`}
              onClick={() => onTicketSelect?.(ticket)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedTickets.includes(ticket.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedTickets(prev => [...prev, ticket.id]);
                      } else {
                        setSelectedTickets(prev => prev.filter(id => id !== ticket.id));
                      }
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-500">
                        #{ticket.ticketNumber}
                      </span>
                      <Badge className={priorityColors[ticket.priority]}>
                        {ticket.priority}
                      </Badge>
                      <Badge className={statusColors[ticket.status]}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                      {isTicketOverdue && (
                        <Badge className="bg-red-100 text-red-800">
                          Overdue
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      {ticket.subject}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        From: {ticket.requesterName || ticket.requesterEmail}
                      </span>
                      {ticket.assignedToUser && (
                        <span>
                          Assigned to: {ticket.assignedToUser.name || ticket.assignedToUser.email}
                        </span>
                      )}
                      <span>
                        Created: {formatDate(ticket.createdAt)}
                      </span>
                      {ticket.dueDate && (
                        <span>
                          Due: {formatDate(ticket.dueDate)}
                        </span>
                      )}
                      {ticket._count && (
                        <span>
                          {ticket._count.comments} comments
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Dropdown
                  trigger={
                    <Button variant="ghost" size="sm">
                      <EllipsisVerticalIcon className="h-4 w-4" />
                    </Button>
                  }
                  items={[
                    {
                      label: 'View Details',
                      onClick: () => onTicketSelect?.(ticket),
                    },
                    {
                      label: 'Mark as In Progress',
                      onClick: () => handleBulkUpdate({ status: TicketStatus.IN_PROGRESS }),
                    },
                    {
                      label: 'Mark as Resolved',
                      onClick: () => handleBulkUpdate({ status: TicketStatus.RESOLVED }),
                    },
                    {
                      label: 'Close Ticket',
                      onClick: () => handleBulkUpdate({ status: TicketStatus.CLOSED }),
                    },
                  ]}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} tickets
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.pages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {tickets.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <ClockIcon className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No tickets found
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || Object.keys(filters).length > 0
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first support ticket'}
          </p>
          {onCreateTicket && (
            <Button onClick={onCreateTicket}>
              Create First Ticket
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}