/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE ?? "false",
    NEXT_PUBLIC_CLIO_CLIENT_ID: process.env.CLIO_CLIENT_ID ?? "",
  },
};

module.exports = nextConfig;
