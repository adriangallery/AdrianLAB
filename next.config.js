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
      // === V2 SWAP: custom-external now routes to V2 ===
      { source: '/api/render/custom-external/:path*', destination: '/api/v2/render/custom-external/:path*' },
      // Uncomment these to swap render and metadata too:
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