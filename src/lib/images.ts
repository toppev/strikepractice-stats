import fs from "node:fs";
import path from "node:path";
import { fillTemplate, getConfig } from "./config";
import type { Item } from "./sp/items";

/**
 * Image URLs, built from the templates in config.yml (images.*). Server-side only: client
 * components get finished URLs as props.
 */

export function headUrl(player: { uuid: string; name: string }, size = 64): string {
  return fillTemplate(getConfig().images.head, { uuid: player.uuid.replace(/-/g, ""), name: player.name, size });
}

export function bodyUrl(player: { uuid: string; name: string }, size = 256): string {
  return fillTemplate(getConfig().images.body, { uuid: player.uuid.replace(/-/g, ""), name: player.name, size });
}

export function textureUrl(path: string): string {
  return fillTemplate(getConfig().images.texture, { path });
}

/** Branding files (logo, arena banners) live in branding/ and are served from /branding/... */
export function brandingUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//.test(value) || value.startsWith("/")) return value;
  return `/branding/${value}`;
}

const BRANDING_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.BRANDING_DIR ?? "branding");
const ARENA_EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png", ".avif"];
const arenaFiles = new Map<string, { checked: number; url?: string }>();

/**
 * Banner image for an arena (key = arena name without color codes, lowercased):
 * arenas.<key>.image in config.yml, else a file named after the arena in branding/arenas/
 * (river.webp, river.jpg, ...). File lookups are remembered for a minute.
 */
export function arenaImage(key: string): string | undefined {
  const configured = getConfig().arenas[key]?.image;
  if (configured) return brandingUrl(configured);
  if (!/^[a-z0-9_ -]+$/.test(key)) return undefined;
  const hit = arenaFiles.get(key);
  if (hit && Date.now() - hit.checked < 60_000) return hit.url;
  const ext = ARENA_EXTENSIONS.find((e) => fs.existsSync(path.join(/*turbopackIgnore: true*/ BRANDING_DIR, "arenas", key + e)));
  const url = ext ? `/branding/arenas/${encodeURIComponent(key + ext)}` : undefined;
  arenaFiles.set(key, { checked: Date.now(), url });
  return url;
}

export type ItemImage =
  | { kind: "image"; sources: string[] }
  | { kind: "potion"; bottle: string; overlay: string; color: string };

/**
 * How to draw an item. Rendered icons first (blocks look 3D there), then the flat item and block
 * textures as fallbacks for anything the icon set doesn't have.
 */
export function itemImage(item: Pick<Item, "id" | "potion">): ItemImage {
  if (item.potion && (item.id === "potion" || item.id === "splash_potion" || item.id === "lingering_potion")) {
    return {
      kind: "potion",
      bottle: textureUrl(`item/${item.id}`),
      overlay: textureUrl("item/potion_overlay"),
      color: item.potion.color,
    };
  }
  const config = getConfig();
  return {
    kind: "image",
    sources: [fillTemplate(config.images.item, { id: item.id }), textureUrl(`item/${item.id}`), textureUrl(`block/${item.id}`)],
  };
}
