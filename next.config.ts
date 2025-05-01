import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    nodeMiddleware: true,
  },
  webpack: (config, { isServer }) => {
    // Ignore cloudflare:sockets import during build
    config.externals = [...config.externals, "cloudflare:sockets"];
    return config;
  },
};

export default nextConfig;
