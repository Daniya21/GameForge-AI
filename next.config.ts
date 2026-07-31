import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack anchored to the folder that contains this package.json.
  // This avoids the wrong-root warning when an extracted ZIP sits beside
  // another package-lock.json in Downloads.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
