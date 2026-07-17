import type { NextConfig } from "next";

const r2Host = (() => {
  try {
    const url = process.env.R2_PUBLIC_URL;
    if (!url) return "pub-b74eb25e963945269ceb68342fddeb48.r2.dev";
    return new URL(url).hostname;
  } catch {
    return "pub-b74eb25e963945269ceb68342fddeb48.r2.dev";
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: r2Host,
        pathname: "/**",
      },
      {
        // Dev fallback for placeholder / third-party HTTPS images
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
