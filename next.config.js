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
  }
}

export default nextConfig; 