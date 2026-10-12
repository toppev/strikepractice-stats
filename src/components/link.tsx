import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * next/link without prefetching; use this one everywhere. Every page here is dynamic and reads the
 * database, yet Next.js 16 still prefetches each link as it scrolls into view: one leaderboard
 * would render its 50 player pages in the background, and each of those counts against the
 * visitor's rate limit (src/proxy.ts). Clicking still navigates without a full page load.
 */
export function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={false} />;
}
