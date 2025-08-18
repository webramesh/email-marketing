'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Create a separate component for devtools to avoid context issues
function DevTools() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  try {
    const { ReactQueryDevtools } = require('@tanstack/react-query-devtools');
    return <ReactQueryDevtools initialIsOpen={false} />;
  } catch (error) {
    console.warn('React Query Devtools not available');
    return null;
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance once per component instance
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          // With SSR, we usually want to set some default staleTime
          // above 0 to avoid refetching immediately on the client
          staleTime: 60 * 1000, // 1 minute
          retry: (failureCount, error: any) => {
            // Don't retry on 4xx errors
            if (error?.status >= 400 && error?.status < 500) {
              return false;
            }
            // Retry up to 3 times for other errors
            return failureCount < 3;
          },
        },
        mutations: {
          retry: false,
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <DevTools />
    </QueryClientProvider>
  );
}