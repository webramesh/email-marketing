'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

interface User {
  id: string;
  email: string;
  name?: string;
  isCompromised: boolean;
  passwordExpiresAt?: string;
  mustChangePassword: boolean;
  lockedUntil?: string;
  failedLoginAttempts: number;
  lastLoginAt?: string;
}

interface PasswordSecurityManagementProps {
  userRole: string;
}

export function PasswordSecurityManagement({ userRole }: PasswordSecurityManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'force_reset' | 'mark_compromised' | 'unlock_accounts'>('force_reset');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'compromised' | 'expired' | 'locked'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // This would be a new API endpoint to fetch users with password security info
      const response = await fetch('/api/admin/users?include=password-security');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async () => {
    if (selectedUsers.length === 0) return;

    setBulkLoading(true);
    try {
      const response = await fetch('/api/auth/password-security/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: bulkAction,
          userIds: selectedUsers,
          reason: bulkReason,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Success: ${result.message}\nAffected users: ${result.affectedUsers}`);
        setShowBulkModal(false);
        setSelectedUsers([]);
        setBulkReason('');
        fetchUsers(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert('Network error occurred');
    } finally {
      setBulkLoading(false);
    }
  };

  const scheduleExpirationNotifications = async () => {
    try {
      const response = await fetch('/api/auth/password-expiration', {
        method: 'POST',
      });

      if (response.ok) {
        alert('Password expiration notifications scheduled successfully');
      } else {
        alert('Failed to schedule notifications');
      }
    } catch (error) {
      alert('Network error occurred');
    }
  };

  const filteredUsers = users.filter(user => {
    switch (filter) {
      case 'compromised':
        return user.isCompromised;
      case 'expired':
        return user.passwordExpiresAt && new Date(user.passwordExpiresAt) < new Date();
      case 'locked':
        return user.lockedUntil && new Date(user.lockedUntil) > new Date();
      default:
        return true;
    }
  });

  const getStatusBadge = (user: User) => {
    if (user.isCompromised) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Compromised</span>;
    }
    if (user.passwordExpiresAt && new Date(user.passwordExpiresAt) < new Date()) {
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Expired</span>;
    }
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">Locked</span>;
    }
    if (user.mustChangePassword) {
      return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">Must Change</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Good</span>;
  };

  if (!['ADMIN', 'SUPERADMIN'].includes(userRole)) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">
          <p>You don't have permission to access password security management.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Password Security Management</h2>
          <div className="flex space-x-3">
            <Button
              onClick={scheduleExpirationNotifications}
              variant="outline"
              className="text-sm"
            >
              Send Expiration Notifications
            </Button>
            <Button
              onClick={() => setShowBulkModal(true)}
              disabled={selectedUsers.length === 0}
              className="text-sm"
            >
              Bulk Actions ({selectedUsers.length})
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-2 mb-4">
          {[
            { key: 'all', label: 'All Users' },
            { key: 'compromised', label: 'Compromised' },
            { key: 'expired', label: 'Expired' },
            { key: 'locked', label: 'Locked' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-3 py-1 text-sm rounded-md ${
                filter === key
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(filteredUsers.map(u => u.id));
                        } else {
                          setSelectedUsers([]);
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Password Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Failed Attempts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.passwordExpiresAt 
                        ? new Date(user.passwordExpiresAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.failedLoginAttempts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.lastLoginAt 
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No users found matching the current filter.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Bulk Action Modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Password Security Action"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="force_reset">Force Password Reset</option>
              <option value="mark_compromised">Mark as Compromised</option>
              <option value="unlock_accounts">Unlock Accounts</option>
            </select>
          </div>

          {bulkAction === 'mark_compromised' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <Input
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Enter reason for marking as compromised"
              />
            </div>
          )}

          <div className="bg-yellow-50 p-3 rounded-md">
            <p className="text-sm text-yellow-800">
              This action will affect {selectedUsers.length} selected user(s).
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowBulkModal(false)}
              disabled={bulkLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAction}
              disabled={bulkLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkLoading ? 'Processing...' : 'Execute Action'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}