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
import {
  ArrowLeftIcon,
  PaperClipIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

interface TicketComment {
  id: string;
  content: string;
  isInternal: boolean;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
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
  comments: TicketComment[];
  attachments: any[];
  escalations: any[];
  slaEvents: any[];
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

export function SupportTicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingTicket, setEditingTicket] = useState(false);
  const [editForm, setEditForm] = useState<{
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
  }>({
    subject: '',
    status: TicketStatus.OPEN,
    priority: TicketPriority.MEDIUM,
    category: TicketCategory.GENERAL,
  });

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/support/tickets/${ticketId}`);
      if (!response.ok) throw new Error('Failed to fetch ticket');

      const data = await response.json();
      setTicket(data);
      setEditForm({
        subject: data.subject,
        status: data.status,
        priority: data.priority,
        category: data.category,
      });
    } catch (error) {
      console.error('Error fetching ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmittingComment(true);
      const response = await fetch(`/api/support/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          isInternal,
        }),
      });

      if (!response.ok) throw new Error('Failed to add comment');

      setNewComment('');
      setIsInternal(false);
      fetchTicket(); // Refresh to get the new comment
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateTicket = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) throw new Error('Failed to update ticket');

      setEditingTicket(false);
      fetchTicket(); // Refresh to get updated data
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  if (!ticket) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Ticket not found</p>
        <Button onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-gray-900">
                #{ticket.ticketNumber}
              </h1>
              <Badge className={priorityColors[ticket.priority]}>
                {ticket.priority}
              </Badge>
              <Badge className={statusColors[ticket.status]}>
                {ticket.status.replace('_', ' ')}
              </Badge>
              {isOverdue(ticket.dueDate) && (
                <Badge className="bg-red-100 text-red-800">
                  Overdue
                </Badge>
              )}
            </div>
            <p className="text-gray-600">{ticket.subject}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setEditingTicket(!editingTicket)}
        >
          {editingTicket ? 'Cancel' : 'Edit Ticket'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Details */}
          <Card className="p-6">
            {editingTicket ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <Input
                    value={editForm.subject}
                    onChange={(e) => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as TicketStatus }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
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
                      value={editForm.priority}
                      onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
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
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value as TicketCategory }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      {Object.values(TicketCategory).map(category => (
                        <option key={category} value={category}>
                          {category.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUpdateTicket}>
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingTicket(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Description
                </h3>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {ticket.description}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Comments */}
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <ChatBubbleLeftIcon className="h-5 w-5" />
              Comments ({ticket.comments.length})
            </h3>

            <div className="space-y-4 mb-6">
              {ticket.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-4 rounded-lg ${comment.isInternal
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'bg-gray-50 border border-gray-200'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {comment.authorName || comment.authorEmail}
                      </span>
                      {comment.isInternal && (
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                          Internal
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="border-t pt-4">
              <div className="space-y-4">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    <span className="text-sm text-gray-600">Internal comment</span>
                  </label>
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                  >
                    {submittingComment ? 'Adding...' : 'Add Comment'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <Card className="p-4">
            <h3 className="font-medium text-gray-900 mb-4">Ticket Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-gray-600">Requester:</span>
                  <div className="font-medium">
                    {ticket.requesterName || ticket.requesterEmail}
                  </div>
                </div>
              </div>

              {ticket.assignedToUser && (
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-600">Assigned to:</span>
                    <div className="font-medium">
                      {ticket.assignedToUser.name || ticket.assignedToUser.email}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-gray-600">Created:</span>
                  <div className="font-medium">
                    {formatDate(ticket.createdAt)}
                  </div>
                </div>
              </div>

              {ticket.dueDate && (
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-600">Due:</span>
                    <div className={`font-medium ${isOverdue(ticket.dueDate) ? 'text-red-600' : ''}`}>
                      {formatDate(ticket.dueDate)}
                    </div>
                  </div>
                </div>
              )}

              {ticket.assignedCompany && (
                <div className="flex items-center gap-2">
                  <TagIcon className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-600">Company:</span>
                    <div className="font-medium">
                      {ticket.assignedCompany}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* SLA Information */}
          {ticket.slaEvents.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">SLA Status</h3>
              <div className="space-y-2 text-sm">
                {ticket.slaEvents.map((event: any) => (
                  <div key={event.id} className="flex justify-between">
                    <span className="text-gray-600">
                      {event.eventType.replace('_', ' ')}:
                    </span>
                    <span className={`font-medium ${event.isBreached ? 'text-red-600' : 'text-green-600'}`}>
                      {event.isBreached ? 'Breached' : 'On Time'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Attachments */}
          {ticket.attachments.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <PaperClipIcon className="h-4 w-4" />
                Attachments ({ticket.attachments.length})
              </h3>
              <div className="space-y-2">
                {ticket.attachments.map((attachment: any) => (
                  <div key={attachment.id} className="flex items-center gap-2 text-sm">
                    <PaperClipIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">{attachment.originalName}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}