'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useSubscription } from '@/hooks/useSubscription';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  total: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string;
  paidAt?: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
}

interface BillingReport {
  totalRevenue: number;
  invoicesGenerated: number;
  paymentSuccessRate: number;
  overageCharges: number;
  failedPayments: number;
  details: any[];
}

export function BillingDashboard() {
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [upcomingInvoice, setUpcomingInvoice] = useState<Invoice | null>(null);
  const [billingReport, setBillingReport] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadBillingData();
  }, [dateRange]);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      
      // Load invoices
      const invoicesResponse = await fetch(
        `/api/billing?action=invoices&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const invoicesData = await invoicesResponse.json();
      
      // Load upcoming invoice
      const upcomingResponse = await fetch('/api/billing?action=upcoming');
      const upcomingData = await upcomingResponse.json();
      
      // Load billing report
      const reportResponse = await fetch(
        `/api/billing?action=report&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const reportData = await reportResponse.json();
      
      setInvoices(invoicesData.invoices || []);
      setUpcomingInvoice(upcomingData.invoice);
      setBillingReport(reportData.report);
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = async (invoiceId: string) => {
    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'retry_payment',
          invoiceId
        })
      });

      if (response.ok) {
        await loadBillingData();
      }
    } catch (error) {
      console.error('Failed to retry payment:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'success';
      case 'open':
        return 'warning';
      case 'void':
      case 'uncollectible':
        return 'error';
      default:
        return 'secondary';
    }
  };

  if (subscriptionLoading || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Billing Overview */}
      {billingReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(billingReport.totalRevenue)}
            </div>
            <div className="text-sm text-gray-600">Total Revenue</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-2xl font-bold">
              {billingReport.invoicesGenerated}
            </div>
            <div className="text-sm text-gray-600">Invoices Generated</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {billingReport.paymentSuccessRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Payment Success Rate</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(billingReport.overageCharges)}
            </div>
            <div className="text-sm text-gray-600">Overage Charges</div>
          </Card>
        </div>
      )}

      {/* Date Range Filter */}
      <Card className="p-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="border rounded px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="border rounded px-3 py-2"
            />
          </div>
          
          <div className="pt-6">
            <Button onClick={loadBillingData} variant="primary">
              Update Report
            </Button>
          </div>
        </div>
      </Card>

      {/* Upcoming Invoice */}
      {upcomingInvoice && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upcoming Invoice</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Amount Due</div>
              <div className="text-lg font-semibold">
                {formatCurrency(upcomingInvoice.total, upcomingInvoice.currency)}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600">Due Date</div>
              <div className="text-lg font-semibold">
                {formatDate(upcomingInvoice.dueDate)}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600">Billing Period</div>
              <div className="text-lg font-semibold">
                {formatDate(upcomingInvoice.periodStart)} - {formatDate(upcomingInvoice.periodEnd)}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Current Subscription Summary */}
      {subscription && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Current Subscription</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Plan</div>
              <div className="text-lg font-semibold">{subscription.plan.name}</div>
              <div className="text-sm text-gray-500">
                {formatCurrency(subscription.plan.price, subscription.plan.currency)}/{subscription.plan.billingCycle}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <Badge variant={subscription.status === 'active' ? 'success' : 'warning'}>
                {subscription.status}
              </Badge>
            </div>
            
            <div>
              <div className="text-sm text-gray-600">Next Billing Date</div>
              <div className="text-lg font-semibold">
                {formatDate(subscription.currentPeriodEnd)}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Invoice History */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Invoice History</h2>
        
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No invoices found for the selected period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Invoice #</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Due Date</th>
                  <th className="text-left py-2">Period</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b">
                    <td className="py-3">
                      <button
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setShowInvoiceModal(true);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </button>
                    </td>
                    <td className="py-3">
                      <Badge variant={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </td>
                    <td className="py-3">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="py-3">
                      {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                    </td>
                    <td className="py-3">
                      {invoice.status === 'open' && invoice.amountDue > 0 && (
                        <Button
                          onClick={() => handleRetryPayment(invoice.id)}
                          variant="outline"
                          size="sm"
                        >
                          Retry Payment
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedInvoice(null);
        }}
        title={`Invoice ${selectedInvoice?.invoiceNumber}`}
      >
        {selectedInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <Badge variant={getStatusColor(selectedInvoice.status)}>
                  {selectedInvoice.status}
                </Badge>
              </div>
              
              <div>
                <div className="text-sm text-gray-600">Total Amount</div>
                <div className="font-semibold">
                  {formatCurrency(selectedInvoice.total, selectedInvoice.currency)}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600">Amount Paid</div>
                <div className="font-semibold">
                  {formatCurrency(selectedInvoice.amountPaid, selectedInvoice.currency)}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600">Amount Due</div>
                <div className="font-semibold">
                  {formatCurrency(selectedInvoice.amountDue, selectedInvoice.currency)}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600">Due Date</div>
                <div className="font-semibold">
                  {formatDate(selectedInvoice.dueDate)}
                </div>
              </div>
              
              {selectedInvoice.paidAt && (
                <div>
                  <div className="text-sm text-gray-600">Paid Date</div>
                  <div className="font-semibold">
                    {formatDate(selectedInvoice.paidAt)}
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <div className="text-sm text-gray-600">Billing Period</div>
              <div className="font-semibold">
                {formatDate(selectedInvoice.periodStart)} - {formatDate(selectedInvoice.periodEnd)}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setSelectedInvoice(null);
                }}
                variant="outline"
              >
                Close
              </Button>
              
              {selectedInvoice.status === 'open' && selectedInvoice.amountDue > 0 && (
                <Button
                  onClick={() => handleRetryPayment(selectedInvoice.id)}
                  variant="primary"
                >
                  Retry Payment
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}