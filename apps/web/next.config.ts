import type { NextConfig } from 'next';

/**
 * Proxy reverso do BFF. Tudo que o browser chama em `/bff/*` (mesma origem do web)
 * é reescrito no servidor Next para o BFF interno. Assim o cookie de sessão vive na
 * origem do web e o middleware o enxerga — sem depender de cookie cross-subdomínio.
 * Dev: BFF_INTERNAL_URL=http://localhost:3032. Docker: http://bff:3032.
 */
const BFF_INTERNAL_URL = process.env.BFF_INTERNAL_URL ?? 'http://calculaai-bff-9ff0uq:3032';

const nextConfig: NextConfig = {
  transpilePackages: ['@finance/ui', '@finance/contracts'],
  async rewrites() {
    return [
      {
        source: '/bff/:path*',
        destination: `${BFF_INTERNAL_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
