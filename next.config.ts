import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        // Cloudflare R2 public bucket CDN
        protocol: "https",
        hostname: "pub-c8c70e5198974deabcfa60c411b6256a.r2.dev",
        pathname: "/**",
      },
      {
        // Allow any hostname in dev so placeholder/test image URLs don't crash
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
