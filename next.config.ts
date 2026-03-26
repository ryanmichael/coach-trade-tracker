import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile workspace packages from source rather than pre-built dist
  transpilePackages: ["@repo/agents", "@repo/shared"],
  // Prevent Next.js from bundling these — they use native modules
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
