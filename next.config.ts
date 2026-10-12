import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, which is what the Docker image runs
  output: "standalone",
  // Never let a broken image URL in someone's config take the site down. Images are plain <img>
  // tags (heads and item textures come from public CDNs), so the optimizer isn't used.
  images: { unoptimized: true },
  poweredByHeader: false,
  // Safe defaults that can't break a page. No X-Frame-Options / frame-ancestors on purpose, so
  // server owners can embed pages in their own sites (there are no logins or actions to clickjack).
  // A Content-Security-Policy would have to list every image host in config.yml; left to forks.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
