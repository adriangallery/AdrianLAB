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
      }
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