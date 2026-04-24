import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  transpilePackages: ['@hcc/ui'],
};

export default nextConfig;
