import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude Bull and related Node.js-only packages from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
      
      config.externals = [
        ...(config.externals || []),
        'bull',
        'ioredis',
        'redis',
      ];
    }
    
    return config;
  },
  serverExternalPackages: ['bull', 'ioredis', 'redis'],
};

export default nextConfig;
