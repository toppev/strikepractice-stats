import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { clientIp, hit, isPrivate } from "@/lib/rate-limit";

/**
 * Rate limit in front of every page and API route: each visitor (IP address) gets
 * `rateLimitPerMinute` requests per minute (config.yml), so one aggressive crawler or script can't
 * keep the database busy for everyone. Search suggestions count too; the search box only asks when
 * typing pauses and remembers answers, so looking up players costs a few requests per name.
 * Static files, branding images and the health check don't count.
 * One page view is one request because links don't prefetch (src/components/link.tsx). With
 * next/link's default, every link scrolling into view would be a request counted here.
 */
export function proxy(request: NextRequest) {
  const { limit, cloudflare } = settings();
  const ip = clientIp(request.headers, cloudflare);
  // Without the visitor's own address there's no telling visitors apart: better no limit than one
  // limit shared by everyone
  if (limit === 0 || !ip || isPrivate(ip)) return NextResponse.next();

  const retryAfter = hit(ip, limit);
  if (retryAfter === 0) return NextResponse.next();
  return new NextResponse("Too many requests. Wait a minute and try again.\n", {
    status: 429,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(retryAfter) },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|branding/|api/health|icon|favicon).*)"],
};

function settings(): { limit: number; cloudflare: boolean } {
  try {
    const config = getConfig();
    return { limit: config.rateLimitPerMinute, cloudflare: config.behindCloudflare };
  } catch {
    return { limit: 0, cloudflare: false }; // config.yml is invalid: let the page show that error
  }
}
