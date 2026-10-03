import type { NextConfig } from "next";

// One .env at the repo root serves the payments API, the detector and this app. On Vercel the project's env vars are used instead.
try {
  process.loadEnvFile("../.env");
} catch {
  // no root .env (Vercel, CI)
}

const nextConfig: NextConfig = {};

export default nextConfig;
