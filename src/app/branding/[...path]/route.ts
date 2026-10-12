import fs from "node:fs/promises";
import path from "node:path";

/**
 * Serves files from the branding folder (BRANDING_DIR, default ./branding) at /branding/...
 * Next.js only serves public/ files that existed at build time; this lets Docker users mount
 * their logo and arena images without rebuilding the image.
 */
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.BRANDING_DIR ?? "branding");

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const file = path.resolve(/*turbopackIgnore: true*/ ROOT, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  // Stay inside the folder, and only hand out images
  if (!file.startsWith(ROOT + path.sep) || !type) return new Response("Not found", { status: 404 });
  try {
    const body = await fs.readFile(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
        // SVGs could carry scripts or forms; opened directly, one may only draw itself
        ...(type === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
