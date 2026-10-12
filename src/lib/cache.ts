import { getConfig } from "./config";

type Entry = { expires: number; value: Promise<unknown> };

const holder = globalThis as unknown as { __spCache?: Map<string, Entry> };
const store = (holder.__spCache ??= new Map());

/**
 * Remembers a query result for `cacheSeconds` (config.yml), scaled by `weight` for the heavy
 * queries that scan whole tables. Concurrent callers share one in-flight query.
 * Process memory only: fine for one container, and it empties itself on restart.
 */
export function cached<T>(key: string, load: () => Promise<T>, weight = 1): Promise<T> {
  const ttl = getConfig().cacheSeconds * 1000 * weight;
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;

  const value = load().catch((err) => {
    store.delete(key); // don't remember failures
    throw err;
  });
  if (ttl > 0) {
    store.set(key, { expires: now + ttl, value });
    if (store.size > 2000) prune(now);
  }
  return value;
}

/** Drops one remembered result, for a miss that won't stay one (see getFightIdByStart) */
export function forget(key: string) {
  store.delete(key);
}

function prune(now: number) {
  for (const [key, entry] of store) {
    if (entry.expires <= now) store.delete(key);
  }
}
