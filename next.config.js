/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE ?? "false",
  },
};

module.exports = nextConfig;
