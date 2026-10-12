import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * Site settings, read from config.yml at runtime (no rebuild needed: edit, then refresh the page).
 * Every field has a default, so an empty or missing file still gives a working site.
 * The documented copy is config.yml in the repository root - keep it in sync when adding a field.
 */

const link = z.object({ label: z.string(), url: z.string() });

const kit = z.object({
  /** Shown instead of the kit's in-game name */
  name: z.string().optional(),
  /** Item id for the icon, e.g. "diamond_sword" or "splash_potion:strong_healing" */
  icon: z.string().optional(),
  /** Hide the kit from leaderboards, filters and profiles */
  hidden: z.boolean().optional(),
});

const arena = z.object({
  name: z.string().optional(),
  /** Banner image for fights in this arena: a path under branding/ ("/branding/arenas/river.webp") or a URL */
  image: z.string().optional(),
});

const schema = z.object({
  site: z
    .object({
      name: z.string().default("StrikePractice"),
      tagline: z.string().default("Practice PvP stats, fights and leaderboards."),
      serverIp: z.string().optional(),
      url: z.string().optional(),
      logo: z.string().optional(),
      links: z.array(link).default([]),
    })
    .prefault({}),
  theme: z
    .object({
      /** Brand color for links, highlights and the #1 spot */
      accent: z.string().default("#ffb21e"),
      /** Any other CSS variable from globals.css, e.g. { "--bg": "#101418" } */
      colors: z.record(z.string(), z.string()).default({}),
    })
    .prefault({}),
  images: z
    .object({
      /** {uuid}, {name} and {size} are filled in. Offline-mode servers should use {name}. */
      head: z.string().default("https://mc-heads.net/avatar/{uuid}/{size}"),
      body: z.string().default("https://mc-heads.net/body/{uuid}/{size}"),
      /** Rendered inventory icon of an item, {id} is e.g. "diamond_sword" */
      item: z.string().default("https://mc.nerothe.com/img/1.21.11/minecraft_{id}.png"),
      /** Raw game textures, {path} is e.g. "item/potion_overlay". Used to tint potions. */
      texture: z.string().default("https://assets.mcasset.cloud/1.21.8/assets/minecraft/textures/{path}.png"),
    })
    .prefault({}),
  kits: z.record(z.string(), kit).default({}),
  arenas: z.record(z.string(), arena).default({}),
  leaderboards: z
    .object({
      pageSize: z.number().int().min(5).max(200).default(50),
      /** Also list the event boards (LMS, brackets, sumo, juggernaut, party vs party) when they have any wins */
      events: z.boolean().default(true),
    })
    .prefault({}),
  /** The plugin's starting elo. Players still on it in a kit haven't played it ranked, so they're left off its board. */
  startingElo: z.number().int().default(1000),
  /** How long query results are reused, in seconds. Raise it for big databases. */
  cacheSeconds: z.number().int().min(0).default(60),
  /** Page and search requests one visitor (IP address) may make per minute before getting a 429. 0 = no limit. */
  rateLimitPerMinute: z.number().int().min(0).default(600),
  /** Take visitors' addresses from Cloudflare's CF-Connecting-IP. Off by default: anyone can send that header. */
  behindCloudflare: z.boolean().default(false),
});

export type SiteConfig = z.infer<typeof schema>;
export type KitConfig = z.infer<typeof kit>;

const CONFIG_PATH = path.resolve(/*turbopackIgnore: true*/ process.env.CONFIG_PATH ?? "config.yml");

let cached: { mtimeMs: number; config: SiteConfig } | undefined;
let warnedDirectory = false;

/** Reads config.yml again whenever the file changes, so edits show up on the next request. */
export function getConfig(): SiteConfig {
  let mtimeMs = -1;
  try {
    const stat = fs.statSync(CONFIG_PATH);
    if (stat.isFile()) mtimeMs = stat.mtimeMs;
    // Docker creates a directory when you mount a config.yml that doesn't exist yet
    else if (!warnedDirectory) {
      warnedDirectory = true;
      console.warn(`${CONFIG_PATH} is a directory, not a file. Using the default settings. Create config.yml (see the one in the repository).`);
    }
  } catch {
    // No config file: defaults only
  }
  if (cached && cached.mtimeMs === mtimeMs) return cached.config;

  let raw: unknown = {};
  if (mtimeMs >= 0) {
    raw = parseYaml(fs.readFileSync(CONFIG_PATH, "utf8")) ?? {};
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    // Fail loudly: a silently ignored typo in the config is worse than an error page that names it
    throw new Error(`Invalid ${path.basename(CONFIG_PATH)}:\n${z.prettifyError(result.error)}`);
  }
  cached = { mtimeMs, config: result.data };
  return result.data;
}

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? encodeURIComponent(String(values[key])).replace(/%2F/g, "/") : match,
  );
}
