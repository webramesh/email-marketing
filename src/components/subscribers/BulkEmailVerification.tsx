'use client';

import React, { useState, useEffect } from 'react';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { BulkVerificationJob, VerificationStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

interface BulkEmailVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  listId?: string;
  initialEmails?: string[];
}

export function BulkEmailVerification({
  isOpen,
  onClose,
  listId,
  initialEmails = [],
}: BulkEmailVerificationProps) {
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [emailInput, setEmailInput] = useState('');
  const [removeInvalid, setRemoveInvalid] = useState(false);
  const [removeRisky, setRemoveRisky] = useState(false);
  const [currentJob, setCurrentJob] = useState<BulkVerificationJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const {
    startBulkVerification,
    getBulkVerificationJob,
    isBulkVerifying,
    bulkVerificationError,
  } = useEmailVerification();

  // Parse emails from textarea input
  const parseEmails = (input: string): string[] => {
    return input
      .split(/[\n,;]/)
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));
  };

  const handleEmailInputChange = (value: string) => {
    setEmailInput(value);
    const parsedEmails = parseEmails(value);
    setEmails(parsedEmails);
  };

  const handleStartVerification = async () => {
    if (emails.length === 0) return;

    try {
      const job = await startBulkVerification({
        emails,
        listId,
        removeInvalid,
        removeRisky,
      });

      setCurrentJob(job);
      setIsPolling(true);
    } catch (error) {
      console.error('Failed to start bulk verification:', error);
    }
  };

  // Poll for job status updates
  useEffect(() => {
    if (!isPolling || !currentJob) return;

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await getBulkVerificationJob(currentJob.id);
        if (updatedJob) {
          setCurrentJob(updatedJob);
          
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            setIsPolling(false);
          }
        }
      } catch (error) {
        console.error('Failed to get job status:', error);
        setIsPolling(false);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [isPolling, currentJob, getBulkVerificationJob]);

  const handleClose = () => {
    setCurrentJob(null);
    setIsPolling(false);
    setEmails([]);
    setEmailInput('');
    onClose();
  };

  const getProgressPercentage = () => {
    if (!currentJob || currentJob.totalEmails === 0) return 0;
    return Math.round((currentJob.processedEmails / currentJob.totalEmails) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'processing':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Email Verification">
      <div className="space-y-6">
        {!currentJob ? (
          <>
            {/* Email Input Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Addresses
              </label>
              <textarea
                value={emailInput}
                onChange={(e) => handleEmailInputChange(e.target.value)}
                placeholder="Enter email addresses (one per line, or separated by commas/semicolons)"
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {emails.length} valid email addresses detected
              </p>
            </div>

            {/* Options Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Options</h3>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={removeInvalid}
                  onChange={(e) => setRemoveInvalid(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Remove invalid emails from list
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={removeRisky}
                  onChange={(e) => setRemoveRisky(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Remove risky emails from list
                </span>
              </label>
            </div>

            {/* Error Display */}
            {bulkVerificationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">
                  {bulkVerificationError.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleStartVerification}
                disabled={emails.length === 0 || isBulkVerifying}
              >
                {isBulkVerifying ? 'Starting...' : `Verify ${emails.length} Emails`}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Job Progress Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Verification Progress
                </h3>
                <span className={`text-sm font-medium ${getStatusColor(currentJob.status)}`}>
                  {currentJob.status.toUpperCase()}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>

              <div className="text-center text-sm text-gray-600">
                {currentJob.processedEmails} of {currentJob.totalEmails} emails processed
                ({getProgressPercentage()}%)
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {currentJob.validEmails}
                  </div>
                  <div className="text-xs text-gray-500">Valid</div>
                </Card>

                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {currentJob.invalidEmails}
                  </div>
                  <div className="text-xs text-gray-500">Invalid</div>
                </Card>

                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {currentJob.riskyEmails}
                  </div>
                  <div className="text-xs text-gray-500">Risky</div>
                </Card>

                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {currentJob.unknownEmails}
                  </div>
                  <div className="text-xs text-gray-500">Unknown</div>
                </Card>
              </div>

              {/* Job Details */}
              <div className="text-sm text-gray-600 space-y-1">
                <div>Started: {new Date(currentJob.startedAt).toLocaleString()}</div>
                {currentJob.completedAt && (
                  <div>Completed: {new Date(currentJob.completedAt).toLocaleString()}</div>
                )}
                {currentJob.errorMessage && (
                  <div className="text-red-600">Error: {currentJob.errorMessage}</div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                {currentJob.status === 'completed' || currentJob.status === 'failed' ? (
                  <Button onClick={handleClose}>
                    Close
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handleClose}>
                    Close (Job will continue in background)
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

interface BulkVerificationStatsProps {
  className?: string;
}

export function BulkVerificationStats({ className = '' }: BulkVerificationStatsProps) {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/email-verification/stats');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setStats(data.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch verification stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card className={`p-4 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Email Verification Statistics
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
          <div className="text-xs text-gray-500">Valid</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
          <div className="text-xs text-gray-500">Invalid</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.risky}</div>
          <div className="text-xs text-gray-500">Risky</div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">{stats.unknown}</div>
          <div className="text-xs text-gray-500">Unknown</div>
        </div>
      </div>
    </Card>
  );
}