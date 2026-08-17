import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@finance/ui', '@finance/contracts'],
};

export default nextConfig;
