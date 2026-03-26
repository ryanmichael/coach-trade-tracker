import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these — they use native modules
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "sharp", "tesseract.js"],
};

export default nextConfig;
