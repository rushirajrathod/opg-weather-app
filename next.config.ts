import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produce a self-contained build in .next/standalone — required for Docker
  output: 'standalone',
  // Tell Next.js not to bundle Winston — let it run as a native Node.js module on the server
  serverExternalPackages: ['winston'],
};

export default nextConfig;
