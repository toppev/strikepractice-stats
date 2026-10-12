/**
 * Builds an anonymized SQLite demo database from a real StrikePractice database.
 *
 *   DATABASE_URL=mysql://user:pass@host:3306/strikepractice \
 *     npm run sample-data -- --out sample-data/demo.db --fights 450 --keep <uuid> [--keep <uuid>...]
 *
 * - Copies a slice of fights (recent, ranked, and a few older-format ones so every item format
 *   the site parses is covered), their players, and the stats rows of everyone involved plus the
 *   top of each ladder.
 * - Every player except the --keep ones gets a random UUID and a generated name, everywhere:
 *   stats, fight_players and inside the player_data JSON. The mapping uses a random salt that is
 *   never stored, so it can't be reversed.
 * - At the end it scans the output for any original name or UUID that slipped through and fails
 *   if it finds one.
 *
 * The output uses the plugin's own SQLite schema, so it is also a realistic test database.
 */
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { db } from "../src/lib/db";

type Row = Record<string, unknown>;

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const keep = new Set(args.flatMap((a, i) => (args[i - 1] === "--keep" ? [a.toLowerCase()] : [])));
const out = opt("out") ?? "sample-data/demo.db";
const total = Number(opt("fights") ?? 450);

const RANKED = ["DUEL_QUEUE_RANKED", "DUEL_QUEUE_PREMIUM"];
// Only the readable JSON formats; the long-gone obfuscated one ("hh", "aI", ...) is skipped
const READABLE = `(fight_data LIKE '%"jsonVersion"%' OR fight_data LIKE '{"replayUUID"%')`;

// prettier-ignore
const ADJECTIVES = ["Swift","Iron","Silent","Crimson","Frost","Golden","Lucky","Shadow","Brave","Quick","Rusty","Sly","Stormy","Mossy","Ember","Hollow","Bold","Pale","Wild","Lunar","Copper","Ashen","Dusty","Misty","Sunny","Velvet","Rapid","Echo","Night","Prism"];
// prettier-ignore
const NOUNS = ["Fox","Lynx","Golem","Pearl","Comet","Badger","Raven","Falcon","Otter","Wolf","Viper","Bison","Moth","Heron","Mantis","Cobra","Panda","Crane","Gecko","Squid","Blaze","Shulker","Axolotl","Ocelot","Strider","Phantom","Warden","Allay","Sniffer","Hoglin"];

const salt = randomBytes(16);
const hash = (s: string) => createHash("sha256").update(salt).update(s.toLowerCase()).digest();

const uuidMap = new Map<string, string>();
const nameMap = new Map<string, string>();
const usedNames = new Set<string>();
const originalNames = new Set<string>();

function anonUuid(uuid: string): string {
  if (keep.has(uuid.toLowerCase())) return uuid;
  let mapped = uuidMap.get(uuid);
  if (!mapped) {
    const h = hash(`uuid:${uuid}`);
    h[6] = (h[6] & 0x0f) | 0x40; // version 4
    h[8] = (h[8] & 0x3f) | 0x80;
    const hex = h.subarray(0, 16).toString("hex");
    mapped = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    uuidMap.set(uuid, mapped);
  }
  return mapped;
}

/** One generated name per player (keyed by UUID, so name changes stay one person) */
function anonName(uuid: string, name: string): string {
  if (keep.has(uuid.toLowerCase())) return name;
  originalNames.add(name);
  const existing = nameMap.get(uuid);
  if (existing) return existing;
  const h = hash(`name:${uuid}`);
  let candidate = `${ADJECTIVES[h[0] % ADJECTIVES.length]}${NOUNS[h[1] % NOUNS.length]}`;
  for (let i = 2; usedNames.has(candidate.toLowerCase()) || candidate.length > 16; i++) {
    candidate = `${ADJECTIVES[h[i % 32] % ADJECTIVES.length]}${NOUNS[h[(i + 7) % 32] % NOUNS.length]}${h[(i + 3) % 32] % 100}`.slice(0, 16);
  }
  usedNames.add(candidate.toLowerCase());
  nameMap.set(uuid, candidate);
  return candidate;
}

function anonPlayerData(json: unknown, uuid: string, name: string): unknown {
  if (typeof json !== "string") return json;
  let data: Row;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  data.name = anonName(uuid, name);
  data.uuid = anonUuid(uuid);
  const inv = data.fightInventory as Row | undefined;
  if (inv) {
    if (typeof inv.owner === "string") inv.owner = anonName(uuid, inv.owner);
    if (typeof inv.ownerUUID === "string") inv.ownerUUID = anonUuid(inv.ownerUUID);
  }
  return JSON.stringify(data);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the database to copy from");
  const source = await db();
  console.log(`Reading ${source.description}`);
  const ph = (n: unknown[]) => n.map(() => "?").join(",");

  const ids = new Set<number>();
  const pick = async (sql: string, params: (string | number)[] = []) => {
    for (const r of await source.all<{ id: number }>(sql, params)) ids.add(Number(r.id));
  };
  if (keep.size) {
    await pick(
      `SELECT f.id FROM fights f JOIN fight_players fp ON f.started = fp.fight WHERE fp.uuid IN (${ph([...keep])}) AND ${READABLE}`,
      [...keep],
    );
  }
  await pick(`SELECT id FROM fights WHERE mode IN (${ph(RANKED)}) AND ${READABLE} ORDER BY id DESC LIMIT ?`, [...RANKED, Math.round(total * 0.35)]);
  await pick(`SELECT id FROM fights WHERE fight_data LIKE '{"replayUUID"%' ORDER BY id DESC LIMIT ?`, [Math.round(total * 0.08)]);
  const recent = await source.all<{ id: number }>(`SELECT id FROM fights WHERE ${READABLE} ORDER BY id DESC LIMIT ?`, [total * 2]);
  for (const r of recent) {
    if (ids.size >= total) break;
    ids.add(Number(r.id));
  }

  const idList = [...ids];
  const fights: Row[] = [];
  for (let i = 0; i < idList.length; i += 200) {
    const chunk = idList.slice(i, i + 200);
    fights.push(...(await source.all(`SELECT * FROM fights WHERE id IN (${ph(chunk)})`, chunk)));
  }
  const keys = fights.map((f) => String(f.started));
  const players: Row[] = [];
  for (let i = 0; i < keys.length; i += 200) {
    const chunk = keys.slice(i, i + 200);
    players.push(...(await source.all(`SELECT * FROM fight_players WHERE fight IN (${ph(chunk)})`, chunk)));
  }

  const statsColumns = await source.columns("stats");
  const eloColumns = statsColumns.filter((c) => /^elo_[A-Za-z0-9_]+$/.test(c));
  const statUuids = new Set(players.map((p) => String(p.uuid)));
  for (const column of ["global_elo", ...eloColumns]) {
    for (const r of await source.all<{ uuid: string }>(`SELECT uuid FROM stats WHERE ${column} <> 1000 ORDER BY ${column} DESC LIMIT 40`)) {
      statUuids.add(r.uuid);
    }
  }
  const uuidList = [...statUuids];
  const stats: Row[] = [];
  for (let i = 0; i < uuidList.length; i += 200) {
    const chunk = uuidList.slice(i, i + 200);
    stats.push(...(await source.all(`SELECT * FROM stats WHERE uuid IN (${ph(chunk)})`, chunk)));
  }
  await source.close();
  console.log(`Copying ${fights.length} fights, ${players.length} fight players, ${stats.length} stats rows`);

  fs.rmSync(out, { force: true });
  const target = new DatabaseSync(out);
  // Same tables as the plugin's SqliteDatabase.createTables()
  target.exec(`
    CREATE TABLE stats (
      ID INTEGER PRIMARY KEY, uuid VARCHAR(36) NOT NULL UNIQUE, username VARCHAR(16) NOT NULL,
      global_elo int NOT NULL, kills int NOT NULL, deaths int NOT NULL, lms int NOT NULL, brackets int NOT NULL,
      sumo_wins int NOT NULL DEFAULT 0, juggernaut int NOT NULL DEFAULT 0, party_vs_party_wins int NOT NULL
      ${eloColumns.map((c) => `, ${c} int NOT NULL DEFAULT 1000`).join("")}
    );
    CREATE INDEX username_index ON stats (username);
    CREATE TABLE fights (
      id INTEGER PRIMARY KEY, started BIGINT NOT NULL UNIQUE, ended BIGINT NOT NULL UNIQUE, replay_id VARCHAR(36),
      arena VARCHAR(36), kit VARCHAR(36), mode VARCHAR(36), fight_data TEXT
    );
    CREATE INDEX f_replay_id_index ON fights (replay_id);
    CREATE INDEX f_mode_index ON fights (mode);
    CREATE INDEX f_kit_index ON fights (kit);
    CREATE TABLE fight_players (
      id INTEGER PRIMARY KEY, uuid VARCHAR(36) NOT NULL, fight VARCHAR(16) NOT NULL, username VARCHAR(16) NOT NULL,
      is_winner BOOLEAN, player_data TEXT
    );
    CREATE INDEX fp_uuid_index ON fight_players (uuid);
    CREATE INDEX fp_fight_id_index ON fight_players (fight);
    CREATE INDEX fp_is_winner_index ON fight_players (is_winner);
    CREATE UNIQUE INDEX uniq_players ON fight_players (uuid, fight);
    CREATE TABLE replays (replay_id VARCHAR(36) PRIMARY KEY, name VARCHAR(512) NOT NULL, replay_data TEXT NOT NULL);
  `);

  target.exec("BEGIN");
  const insertFight = target.prepare(
    "INSERT INTO fights (id, started, ended, replay_id, arena, kit, mode, fight_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const f of fights.sort((a, b) => Number(a.id) - Number(b.id))) {
    insertFight.run(Number(f.id), Number(f.started), Number(f.ended), str(f.replay_id), str(f.arena), str(f.kit), str(f.mode), str(f.fight_data));
  }
  const insertPlayer = target.prepare(
    "INSERT OR IGNORE INTO fight_players (uuid, fight, username, is_winner, player_data) VALUES (?, ?, ?, ?, ?)",
  );
  for (const p of players) {
    const uuid = String(p.uuid);
    const name = String(p.username);
    insertPlayer.run(anonUuid(uuid), String(p.fight), anonName(uuid, name), Number(p.is_winner ?? 0), str(anonPlayerData(p.player_data, uuid, name)));
  }
  const statNames = ["uuid", "username", "global_elo", "kills", "deaths", "lms", "brackets", "sumo_wins", "juggernaut", "party_vs_party_wins", ...eloColumns];
  const insertStats = target.prepare(`INSERT INTO stats (${statNames.join(", ")}) VALUES (${ph(statNames)})`);
  for (const s of stats) {
    const uuid = String(s.uuid);
    insertStats.run(anonUuid(uuid), anonName(uuid, String(s.username)), ...statNames.slice(2).map((c) => Number(s[c] ?? (c.startsWith("elo_") ? 1000 : 0))));
  }
  target.exec("COMMIT");

  // Leak check: no original name or UUID of an anonymized player may remain anywhere
  const dump: string[] = [];
  for (const table of ["stats", "fights", "fight_players"]) {
    for (const row of target.prepare(`SELECT * FROM ${table}`).all() as Row[]) dump.push(Object.values(row).join("\u0000"));
  }
  const text = dump.join("\n").toLowerCase();
  const leaks = [
    ...[...uuidMap.keys()].filter((u) => text.includes(u.toLowerCase())),
    ...[...originalNames].filter((n) => n.length >= 4 && !usedNames.has(n.toLowerCase()) && new RegExp(`(^|[^a-z0-9_])${escape(n.toLowerCase())}([^a-z0-9_]|$)`).test(text)),
  ];
  target.exec("VACUUM");
  target.close();
  if (leaks.length) {
    fs.rmSync(out, { force: true });
    throw new Error(`Anonymization check failed, found originals in the output: ${leaks.slice(0, 10).join(", ")}`);
  }
  console.log(`Wrote ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB), ${uuidMap.size} players anonymized, leak check passed`);
}

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
