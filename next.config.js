/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: []
  },
  async rewrites() {
    return [
      {
        source: '/metadata/:path*',
        destination: '/metadata/:path*.json'
      },
      // === V2 SWAP: Uncomment these to route V1 traffic to V2 endpoints ===
      // After validating V2 with scripts/validate-v2.js, uncomment and deploy.
      // Monitor 48h, then remove V1 endpoints.
      //
      // { source: '/api/render/:path*', destination: '/api/v2/render/:path*' },
      // { source: '/api/metadata/:path*', destination: '/api/v2/metadata/:path*' },
    ]
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.(ttf|otf|woff|woff2)$/,
      type: 'asset/resource'
    });
    // Asegurar que los archivos JSON se resuelvan correctamente
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.json': ['.json']
    };
    return config;
  }
}

export default nextConfig; 