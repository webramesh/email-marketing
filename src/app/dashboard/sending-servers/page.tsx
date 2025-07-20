'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface SendingServer {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Provider {
  type: string;
  name: string;
  description: string;
  configFields: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
    default?: any;
  }>;
}

export default function SendingServersPage() {
  const [servers, setServers] = useState<SendingServer[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchServers();
    fetchProviders();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/sending-servers');
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/sending-servers/providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const handleCreateServer = async () => {
    if (!selectedProvider) return;

    setCreating(true);
    try {
      const configuration: Record<string, any> = {};
      selectedProvider.configFields.forEach(field => {
        if (formData[field.name] !== undefined) {
          configuration[field.name] = formData[field.name];
        }
      });

      const response = await fetch('/api/sending-servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          type: selectedProvider.type,
          configuration,
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setSelectedProvider(null);
        setFormData({});
        fetchServers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create sending server');
      }
    } catch (error) {
      console.error('Error creating server:', error);
      alert('Failed to create sending server');
    } finally {
      setCreating(false);
    }
  };

  const testServer = async (serverId: string) => {
    try {
      const response = await fetch(`/api/sending-servers/${serverId}/test`, {
        method: 'POST',
      });
      const result = await response.json();
      alert(result.message);
    } catch (error) {
      console.error('Error testing server:', error);
      alert('Failed to test server');
    }
  };

  const toggleServer = async (serverId: string) => {
    try {
      const server = servers.find(s => s.id === serverId);
      if (!server) return;

      const response = await fetch(`/api/sending-servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !server.isActive,
        }),
      });

      if (response.ok) {
        fetchServers();
      }
    } catch (error) {
      console.error('Error toggling server:', error);
    }
  };

  const deleteServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to delete this sending server?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sending-servers/${serverId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchServers();
      }
    } catch (error) {
      console.error('Error deleting server:', error);
    }
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
        <h1 className="text-2xl font-bold">Sending Servers</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Add Sending Server
        </Button>
      </div>

      <div className="grid gap-4">
        {servers.length === 0 ? (
          <Card className="p-8 text-center">
            <h3 className="text-lg font-medium mb-2">No sending servers configured</h3>
            <p className="text-gray-600 mb-4">
              Add your first sending server to start sending emails.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              Add Sending Server
            </Button>
          </Card>
        ) : (
          servers.map(server => (
            <Card key={server.id} className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium">{server.name}</h3>
                    <Badge variant={server.isActive ? 'success' : 'secondary'}>
                      {server.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">{server.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    Created: {new Date(server.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testServer(server.id)}
                  >
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleServer(server.id)}
                  >
                    {server.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteServer(server.id)}
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

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedProvider(null);
          setFormData({});
        }}
        title="Add Sending Server"
      >
        <div className="space-y-4">
          {!selectedProvider ? (
            <>
              <p className="text-gray-600 mb-4">
                Choose a sending provider to configure:
              </p>
              <div className="grid gap-3">
                {providers.map(provider => (
                  <button
                    key={provider.type}
                    onClick={() => setSelectedProvider(provider)}
                    className="p-4 border rounded-lg hover:bg-gray-50 text-left"
                  >
                    <h4 className="font-medium">{provider.name}</h4>
                    <p className="text-sm text-gray-600">{provider.description}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  ← Back to providers
                </button>
                <h3 className="text-lg font-medium mt-2">Configure {selectedProvider.name}</h3>
              </div>

              <div className="space-y-4">
                <Input
                  label="Server Name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter a name for this server"
                  required
                />

                {selectedProvider.configFields.map(field => (
                  <Input
                    key={field.name}
                    label={field.label}
                    type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    value={formData[field.name] || field.default || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value 
                    })}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    required={field.required}
                  />
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedProvider(null);
                    setFormData({});
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateServer}
                  disabled={creating || !formData.name}
                >
                  {creating ? 'Creating...' : 'Create Server'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}