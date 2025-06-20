const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  output: 'standalone',
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      '@/components': path.resolve(__dirname, 'components'),
      'react': path.resolve(__dirname, 'node_modules/react')
    };
    return config;
  },
  reactStrictMode: true,
  swcMinify: true
};

module.exports = nextConfig; 