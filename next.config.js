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
      // === V2 SWAP: all endpoints routed to V2 ===
      // custom-external stays on V1 (has working GIF animated trait pipeline)
      { source: '/api/render/custom-external/:path*', destination: '/api/render/custom-external/:path*' },
      // Floppy metadata stays on V1 (handles .json extension, traits 1-9999, floppies, serums, packs)
      { source: '/api/metadata/floppy/:id.json', destination: '/api/metadata/floppy/:id.json' },
      { source: '/api/metadata/floppy/:id', destination: '/api/metadata/floppy/:id' },
      { source: '/api/metadata/:path*', destination: '/api/v2/metadata/:path*' },
      // Exclude V1-only endpoints from V2 rewrite (no V2 handler exists)
      { source: '/api/render/floppy/:path*', destination: '/api/render/floppy/:path*' },
      { source: '/api/render/custom/:path*', destination: '/api/render/custom/:path*' },
      { source: '/api/render/displacement/:path*', destination: '/api/render/displacement/:path*' },
      { source: '/api/render/lambo/:path*', destination: '/api/render/lambo/:path*' },
      { source: '/api/render/nanobanana/:path*', destination: '/api/render/nanobanana/:path*' },
      { source: '/api/render/test-external/:path*', destination: '/api/render/test-external/:path*' },
      { source: '/api/render/gif', destination: '/api/render/gif' },
      // Catch-all: everything else goes to V2
      { source: '/api/render/:path*', destination: '/api/v2/render/:path*' },
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