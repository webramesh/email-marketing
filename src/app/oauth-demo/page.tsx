'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OAuthSignInButtons } from '@/components/auth/OAuthSignInButtons';
import { OAuthAccountManager } from '@/components/auth/OAuthAccountManager';

interface OAuthAccount {
  id: string;
  provider: string;
  email: string;
  name?: string;
  image?: string;
  linkedAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export default function OAuthDemoPage() {
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchOAuthAccounts();
    }
  }, [session]);

  const fetchOAuthAccounts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/oauth/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error fetching OAuth accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            OAuth Integration Demo
          </h1>
          <p className="text-gray-600">
            Test OAuth authentication with Google, GitHub, and Microsoft
          </p>
        </div>

        {!session ? (
          <div className="max-w-md mx-auto">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-center">
                Sign In to Test OAuth
              </h2>
              <OAuthSignInButtons callbackUrl="/oauth-demo" />
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Info */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Current Session</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    User ID
                  </label>
                  <p className="text-gray-900">{session.user.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <p className="text-gray-900">{session.user.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <p className="text-gray-900">{session.user.name || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <p className="text-gray-900">{session.user.role}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tenant
                  </label>
                  <p className="text-gray-900">{session.user.tenant.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Session Created
                  </label>
                  <p className="text-gray-900">
                    {new Date(session.sessionCreated).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            {/* OAuth Account Management */}
            <div>
              <h2 className="text-xl font-semibold mb-4">OAuth Account Management</h2>
              <OAuthAccountManager />
            </div>

            {/* OAuth Accounts List */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Connected OAuth Accounts</h2>
                <Button
                  onClick={fetchOAuthAccounts}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
              
              {accounts.length === 0 ? (
                <p className="text-gray-600 text-center py-4">
                  No OAuth accounts connected yet. Use the account manager above to connect accounts.
                </p>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        {account.image && (
                          <img
                            src={account.image}
                            alt={account.name || account.email}
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                        <div>
                          <h3 className="font-medium capitalize">
                            {account.provider}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {account.email}
                          </p>
                          {account.name && (
                            <p className="text-sm text-gray-500">
                              {account.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          Linked: {new Date(account.linkedAt).toLocaleDateString()}
                        </div>
                        {account.lastUsedAt && (
                          <div className="text-sm text-gray-500">
                            Last used: {new Date(account.lastUsedAt).toLocaleDateString()}
                          </div>
                        )}
                        <div className={`inline-block px-2 py-1 rounded text-xs ${
                          account.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {account.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Available Tenants */}
            {session.user.availableTenants && session.user.availableTenants.length > 1 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Available Tenants</h2>
                <div className="space-y-2">
                  {session.user.availableTenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className={`p-3 border rounded-lg ${
                        tenant.id === session.user.tenantId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{tenant.name}</h3>
                          <p className="text-sm text-gray-600">
                            {tenant.customDomain || `${tenant.subdomain}.yourdomain.com`}
                          </p>
                        </div>
                        {tenant.id === session.user.tenantId && (
                          <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Debug Info */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(session, null, 2)}
              </pre>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}