import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, which is what the Docker image runs
  output: "standalone",
  // Never let a broken image URL in someone's config take the site down. Images are plain <img>
  // tags (heads and item textures come from public CDNs), so the optimizer isn't used.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
