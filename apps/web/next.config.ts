import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@paradox/shared"],
  // API is on a different origin in local dev — allow CORS via the API itself later
};

export default nextConfig;
