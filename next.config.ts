import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Docker/Cloud Run multi-stage build.
  // Produces a minimal self-contained .next/standalone server.
  output: "standalone",
};

export default nextConfig;
