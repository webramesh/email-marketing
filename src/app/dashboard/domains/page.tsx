'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface Domain {
  id: string;
  name: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DNSRecord {
  name: string;
  type: string;
  value: string;
  status: 'pending' | 'verified' | 'failed';
}

interface DomainDetails {
  domain: Domain;
  dnsRecords: {
    dkim: DNSRecord;
    spf: DNSRecord;
    dmarc?: DNSRecord;
    cname?: DNSRecord;
  };
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainDetails | null>(null);
  const [domainName, setDomainName] = useState('');
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const response = await fetch('/api/domains');
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDomain = async () => {
    if (!domainName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: domainName.trim(),
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setDomainName('');
        fetchDomains();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create domain');
      }
    } catch (error) {
      console.error('Error creating domain:', error);
      alert('Failed to create domain');
    } finally {
      setCreating(false);
    }
  };

  const handleViewDetails = async (domainId: string) => {
    try {
      const response = await fetch(`/api/domains/${domainId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDomain(data);
        setShowDetailsModal(true);
      }
    } catch (error) {
      console.error('Error fetching domain details:', error);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifying(domainId);
    try {
      const response = await fetch(`/api/domains/${domainId}/verify`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedDomain(data);
        fetchDomains();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to verify domain');
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      alert('Failed to verify domain');
    } finally {
      setVerifying(null);
    }
  };

  const handleRegenerateDKIM = async (domainId: string) => {
    if (!confirm('Are you sure you want to regenerate DKIM keys? This will require updating your DNS records.')) {
      return;
    }

    try {
      const response = await fetch(`/api/domains/${domainId}/regenerate-dkim`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedDomain(data);
        fetchDomains();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to regenerate DKIM keys');
      }
    } catch (error) {
      console.error('Error regenerating DKIM keys:', error);
      alert('Failed to regenerate DKIM keys');
    }
  };

  const deleteDomain = async (domainId: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) {
      return;
    }

    try {
      const response = await fetch(`/api/domains/${domainId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchDomains();
      }
    } catch (error) {
      console.error('Error deleting domain:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sending Domains</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Add Domain
        </Button>
      </div>

      <div className="grid gap-4">
        {domains.length === 0 ? (
          <Card className="p-8 text-center">
            <h3 className="text-lg font-medium mb-2">No domains configured</h3>
            <p className="text-gray-600 mb-4">
              Add your first sending domain to improve email deliverability.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              Add Domain
            </Button>
          </Card>
        ) : (
          domains.map(domain => (
            <Card key={domain.id} className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium">{domain.name}</h3>
                    <Badge variant={domain.isVerified ? 'success' : 'warning'}>
                      {domain.isVerified ? 'Verified' : 'Pending'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    Added: {new Date(domain.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(domain.id)}
                  >
                    DNS Records
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerifyDomain(domain.id)}
                    disabled={verifying === domain.id}
                  >
                    {verifying === domain.id ? 'Verifying...' : 'Verify'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteDomain(domain.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create Domain Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setDomainName('');
        }}
        title="Add Sending Domain"
      >
        <div className="space-y-4">
          <Input
            label="Domain Name"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder="example.com"
            required
          />
          <p className="text-sm text-gray-600">
            Enter the domain you want to use for sending emails. You'll need to add DNS records to verify ownership.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setDomainName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDomain}
              disabled={creating || !domainName.trim()}
            >
              {creating ? 'Adding...' : 'Add Domain'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Domain Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedDomain(null);
        }}
        title={`DNS Records for ${selectedDomain?.domain.name}`}
        size="lg"
      >
        {selectedDomain && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={selectedDomain.domain.isVerified ? 'success' : 'warning'}>
                  {selectedDomain.domain.isVerified ? 'Verified' : 'Pending Verification'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyDomain(selectedDomain.domain.id)}
                  disabled={verifying === selectedDomain.domain.id}
                >
                  {verifying === selectedDomain.domain.id ? 'Verifying...' : 'Verify Now'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerateDKIM(selectedDomain.domain.id)}
                >
                  Regenerate DKIM
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {/* DKIM Record */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">DKIM Record</h4>
                  <Badge variant={
                    selectedDomain.dnsRecords.dkim.status === 'verified' ? 'success' :
                    selectedDomain.dnsRecords.dkim.status === 'failed' ? 'destructive' : 'warning'
                  }>
                    {selectedDomain.dnsRecords.dkim.status}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Name:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {selectedDomain.dnsRecords.dkim.name}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(selectedDomain.dnsRecords.dkim.name)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {selectedDomain.dnsRecords.dkim.type}
                  </div>
                  <div>
                    <span className="font-medium">Value:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all">
                        {selectedDomain.dnsRecords.dkim.value}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(selectedDomain.dnsRecords.dkim.value)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SPF Record */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">SPF Record</h4>
                  <Badge variant={
                    selectedDomain.dnsRecords.spf.status === 'verified' ? 'success' :
                    selectedDomain.dnsRecords.spf.status === 'failed' ? 'destructive' : 'warning'
                  }>
                    {selectedDomain.dnsRecords.spf.status}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Name:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {selectedDomain.dnsRecords.spf.name}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(selectedDomain.dnsRecords.spf.name)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {selectedDomain.dnsRecords.spf.type}
                  </div>
                  <div>
                    <span className="font-medium">Value:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {selectedDomain.dnsRecords.spf.value}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(selectedDomain.dnsRecords.spf.value)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* DMARC Record */}
              {selectedDomain.dnsRecords.dmarc && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">DMARC Record (Optional)</h4>
                    <Badge variant={
                      selectedDomain.dnsRecords.dmarc.status === 'verified' ? 'success' :
                      selectedDomain.dnsRecords.dmarc.status === 'failed' ? 'destructive' : 'warning'
                    }>
                      {selectedDomain.dnsRecords.dmarc.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Name:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {selectedDomain.dnsRecords.dmarc.name}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(selectedDomain.dnsRecords.dmarc.name)}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> {selectedDomain.dnsRecords.dmarc.type}
                    </div>
                    <div>
                      <span className="font-medium">Value:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {selectedDomain.dnsRecords.dmarc.value}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(selectedDomain.dnsRecords.dmarc.value)}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Setup Instructions</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Add the DKIM TXT record to your DNS settings</li>
                <li>Add or update the SPF TXT record for your domain</li>
                <li>Optionally add the DMARC TXT record for enhanced security</li>
                <li>Wait for DNS propagation (up to 24 hours)</li>
                <li>Click "Verify Now" to check the records</li>
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}