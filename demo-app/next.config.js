const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['omni-key-sdk'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'omni-key-sdk': path.resolve(__dirname, '../sdk/omni-key-sdk/dist'),
    };
    return config;
  },
};

module.exports = nextConfig;
