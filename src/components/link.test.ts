import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Prefetched links would each render a page and count against the rate limit: see link.tsx
test("links come from @/components/link, not next/link", () => {
  const src = path.join(import.meta.dirname, "..");
  const offenders = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(path.join("components", "link.tsx")) && !file.endsWith(".test.ts"))
    .filter((file) => /from ["']next\/link["']/.test(readFileSync(path.join(src, file), "utf8")));
  assert.deepEqual(offenders, []);
});
