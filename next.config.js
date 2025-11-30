/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    SESSION_SECRET: process.env.SESSION_SECRET,
  },
  // Force rebuild with env vars
}

module.exports = nextConfig
