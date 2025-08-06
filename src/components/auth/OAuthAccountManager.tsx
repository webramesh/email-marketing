'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

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

interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    icon: '🔍',
    description: 'Sign in with your Google account',
    color: 'bg-red-500 hover:bg-red-600',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    description: 'Sign in with your GitHub account',
    color: 'bg-gray-800 hover:bg-gray-900',
  },
  {
    id: 'microsoft-entra-id',
    name: 'Microsoft',
    icon: '🏢',
    description: 'Sign in with your Microsoft account',
    color: 'bg-blue-600 hover:bg-blue-700',
  },
];

export function OAuthAccountManager() {
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  useEffect(() => {
    fetchOAuthAccounts();
  }, []);

  const fetchOAuthAccounts = async () => {
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

  const handleLinkAccount = async (provider: string) => {
    try {
      // Use NextAuth signIn to initiate OAuth flow
      await signIn(provider, {
        callbackUrl: '/dashboard/profile?tab=security&linked=true',
      });
    } catch (error) {
      console.error('Error linking account:', error);
    }
  };

  const handleUnlinkAccount = async (provider: string) => {
    setUnlinkingProvider(provider);
    try {
      const response = await fetch('/api/auth/oauth/unlink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });

      if (response.ok) {
        // Refresh accounts list
        await fetchOAuthAccounts();
        setShowUnlinkModal(false);
      } else {
        const error = await response.json();
        console.error('Error unlinking account:', error);
      }
    } catch (error) {
      console.error('Error unlinking account:', error);
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const confirmUnlink = (provider: string) => {
    setSelectedProvider(provider);
    setShowUnlinkModal(true);
  };

  const getProviderInfo = (providerId: string) => {
    return OAUTH_PROVIDERS.find(p => p.id === providerId);
  };

  const isProviderLinked = (providerId: string) => {
    return accounts.some(account => account.provider === providerId && account.isActive);
  };

  const getLinkedAccount = (providerId: string) => {
    return accounts.find(account => account.provider === providerId && account.isActive);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Connected Accounts</h3>
        <p className="text-gray-600 mb-6">
          Link your social accounts to sign in more easily and securely.
        </p>

        <div className="space-y-4">
          {OAUTH_PROVIDERS.map((provider) => {
            const isLinked = isProviderLinked(provider.id);
            const linkedAccount = getLinkedAccount(provider.id);

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">{provider.icon}</div>
                  <div>
                    <h4 className="font-medium">{provider.name}</h4>
                    <p className="text-sm text-gray-600">
                      {isLinked && linkedAccount
                        ? `Connected as ${linkedAccount.email}`
                        : provider.description}
                    </p>
                    {isLinked && linkedAccount?.lastUsedAt && (
                      <p className="text-xs text-gray-500">
                        Last used: {new Date(linkedAccount.lastUsedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  {isLinked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => confirmUnlink(provider.id)}
                      disabled={unlinkingProvider === provider.id}
                    >
                      {unlinkingProvider === provider.id ? 'Unlinking...' : 'Unlink'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className={provider.color}
                      onClick={() => handleLinkAccount(provider.id)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {accounts.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Security Tip</h4>
            <p className="text-sm text-blue-800">
              You can use any of your connected accounts to sign in. Make sure to keep
              your social accounts secure with strong passwords and two-factor authentication.
            </p>
          </div>
        )}
      </Card>

      {/* Unlink Confirmation Modal */}
      <Modal
        isOpen={showUnlinkModal}
        onClose={() => setShowUnlinkModal(false)}
        title="Unlink Account"
      >
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Are you sure you want to unlink your {selectedProvider} account?
            You won't be able to sign in using this account anymore.
          </p>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowUnlinkModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => selectedProvider && handleUnlinkAccount(selectedProvider)}
              disabled={!!unlinkingProvider}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {unlinkingProvider ? 'Unlinking...' : 'Unlink Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}