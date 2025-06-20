/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  output: 'standalone',
  experimental: {
    serverActions: true
  }
};

module.exports = nextConfig; 