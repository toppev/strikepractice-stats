/**
 * Requests per visitor (IP address) and minute, for src/proxy.ts. Kept in process memory like
 * the query cache: fine for the one container this runs in.
 */

const WINDOW_MS = 60_000;
// Bounds memory. Reaching it just clears the table: everyone starts a fresh minute, which is harmless
const MAX_TRACKED = 10_000;

const holder = globalThis as unknown as { __spRateLimit?: Map<string, { start: number; count: number }> };
const windows = (holder.__spRateLimit ??= new Map());

/** Counts one request. Returns 0 when it's allowed, else the seconds until the visitor may retry. */
export function hit(ip: string, limit: number, now = Date.now()): number {
  let window = windows.get(ip);
  if (!window || now - window.start >= WINDOW_MS) {
    if (windows.size >= MAX_TRACKED) windows.clear();
    window = { start: now, count: 0 };
    windows.set(ip, window);
  }
  window.count++;
  return window.count <= limit ? 0 : Math.ceil((window.start + WINDOW_MS - now) / 1000);
}

// The search box asks after each pause in typing, so looking up a few players is dozens of requests
const SEARCH_FACTOR = 4;

/**
 * Which count a request goes to. Searches get their own, bigger one, so looking up many players
 * doesn't use up the visitor's page views (and can't be used to get around their limit either).
 */
export function bucket(pathname: string, ip: string, perMinute: number): { key: string; limit: number } {
  return pathname === "/api/search" ? { key: `search ${ip}`, limit: perMinute * SEARCH_FACTOR } : { key: ip, limit: perMinute };
}

/**
 * The visitor's address, or undefined when the request doesn't tell. It's the last X-Forwarded-For
 * entry: every proxy appends the address it saw, anything before it may be made up. Without a
 * proxy, Next.js fills in the connecting address, but only when the visitor didn't send the header
 * themselves. Behind Cloudflare (`behindCloudflare`) it's CF-Connecting-IP; otherwise that header
 * is ignored, since anyone can send it.
 */
export function clientIp(headers: Headers, cloudflare = false): string | undefined {
  const fromCloudflare = cloudflare ? headers.get("cf-connecting-ip")?.trim() : undefined;
  if (fromCloudflare) return fromCloudflare;
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || undefined;
}

/**
 * A private or loopback address means the request came through something on the same machine or
 * network that didn't pass the visitor's address on: a proxy without X-Forwarded-For, or Docker's
 * port forwarding for IPv6 visitors. Those can be many visitors behind one address.
 */
export function isPrivate(ip: string): boolean {
  const address = ip.replace(/^::ffff:/i, "");
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address) || /^(::1$|f[cd]|fe[89ab])/i.test(address);
}
