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
  serverExternalPackages: ["@react-pdf/renderer"],
  // PDF fonts are read from node_modules by a computed path (lib/pdf-fonts.ts),
  // which the file tracer can't always follow — without this, serverless
  // functions can ship without them and every PDF download fails. Keep in step
  // with the four files registered in lib/pdf-fonts.ts.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/@fontsource/inter/files/inter-latin-400-normal.woff",
      "./node_modules/@fontsource/inter/files/inter-latin-700-normal.woff",
      "./node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff",
      "./node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-700-normal.woff",
    ],
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
