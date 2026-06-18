import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cloudflare Pages (Edge Runtime) 向け
  experimental: {
    // next-on-pages が Edge に変換するため Node.js ランタイムは使わない
  },
}

export default nextConfig
