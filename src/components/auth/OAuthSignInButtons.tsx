'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/Button';

interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    icon: '🔍',
    color: 'bg-red-500 hover:bg-red-600 text-white',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    color: 'bg-gray-800 hover:bg-gray-900 text-white',
  },
  {
    id: 'microsoft-entra-id',
    name: 'Microsoft',
    icon: '🏢',
    color: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
];

interface OAuthSignInButtonsProps {
  callbackUrl?: string;
  className?: string;
}

export function OAuthSignInButtons({ 
  callbackUrl = '/dashboard',
  className = '' 
}: OAuthSignInButtonsProps) {
  const [signingIn, setSigningIn] = useState<string | null>(null);

  const handleOAuthSignIn = async (provider: string) => {
    setSigningIn(provider);
    try {
      await signIn(provider, {
        callbackUrl,
        redirect: true,
      });
    } catch (error) {
      console.error(`Error signing in with ${provider}:`, error);
      setSigningIn(null);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {OAUTH_PROVIDERS.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            className={`w-full flex items-center justify-center space-x-2 ${provider.color}`}
            onClick={() => handleOAuthSignIn(provider.id)}
            disabled={signingIn === provider.id}
          >
            <span className="text-lg">{provider.icon}</span>
            <span>
              {signingIn === provider.id 
                ? `Signing in with ${provider.name}...` 
                : `Continue with ${provider.name}`
              }
            </span>
          </Button>
        ))}
      </div>

      <div className="text-xs text-gray-500 text-center">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </div>
    </div>
  );
}