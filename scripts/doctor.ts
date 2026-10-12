/**
 * Checks a setup and says what to fix:   npm run doctor
 * (in Docker: docker compose exec stats node scripts/doctor.cjs)
 *
 * - config.yml parses and validates
 * - the database answers, has the plugin's tables, and the indexes the site's queries rely on
 * - fights are being saved at all (the plugin only saves them with save-all-fights / save-elo-fights)
 * - how much of the stored fight JSON this site can read
 *
 * Read-only: it never changes the database. Missing indexes are printed as SQL to run yourself.
 */
import { getConfig } from "../src/lib/config";
import { db, isDemo } from "../src/lib/db";
import { parseFightData, parsePlayerData } from "../src/lib/sp/fight-data";

let problems = 0;
const ok = (msg: string) => console.log(`  ok    ${msg}`);
const warn = (msg: string) => {
  problems++;
  console.log(`  WARN  ${msg}`);
};
const info = (msg: string) => console.log(`        ${msg}`);

async function main() {
  console.log("\nConfig");
  try {
    const config = getConfig();
    ok(`config.yml is valid (site name "${config.site.name}")`);
  } catch (err) {
    warn((err as Error).message);
  }

  console.log("\nDatabase");
  if (isDemo()) info("DATABASE_URL is not set, so this is the bundled demo database");
  const database = await db();
  try {
    await database.get("SELECT 1 AS ok");
    ok(`connected to ${database.description}`);
  } catch (err) {
    warn(`can't query the database: ${(err as Error).message}`);
    return;
  }

  const tables = { stats: await database.columns("stats"), fights: await database.columns("fights"), fight_players: await database.columns("fight_players") };
  for (const [table, columns] of Object.entries(tables)) {
    if (columns.length === 0) warn(`table "${table}" is missing. Is this the StrikePractice database, and is the plugin set to database type mysql/sqlite?`);
    else ok(`table ${table} (${columns.length} columns)`);
  }
  if (tables.stats.length === 0 || tables.fights.length === 0 || tables.fight_players.length === 0) return;

  const elo = tables.stats.filter((c) => c.startsWith("elo_"));
  if (elo.length) ok(`${elo.length} ranked kits: ${elo.map((c) => c.slice(4)).join(", ")}`);
  else info("no elo_<kit> columns: no ranked (elo) kits yet, so no ladders");

  console.log("\nIndexes");
  // [table, columns, why, name for the CREATE INDEX]
  const wanted: [string, string[], string, string][] = [
    ["fight_players", ["uuid"], "profiles, match history, win counts", "fp_uuid_index"],
    ["fight_players", ["fight"], "showing who fought in each fight", "fp_fight_id_index"],
    ["fights", ["started"], "joining fights to their players", "f_started_index"],
    ["fights", ["kit"], "kit filters and kit names", "f_kit_index"],
    ["stats", ["username"], "player search", "username_index"],
  ];
  for (const [table, columns, why, name] of wanted) {
    const indexes = await database.indexes(table);
    const covered = indexes.some((i) => columns.every((c, n) => i.columns[n] === c));
    if (covered) ok(`${table}(${columns.join(", ")})`);
    else {
      warn(`no index on ${table}(${columns.join(", ")}), used for ${why}. Slow on big databases. To add it:`);
      info(`CREATE INDEX ${name} ON ${table} (${columns.join(", ")});`);
    }
  }

  console.log("\nData");
  const counts = await database.get<{ fights: number; players: number; stats: number }>(
    "SELECT (SELECT COUNT(*) FROM fights) AS fights, (SELECT COUNT(*) FROM fight_players) AS players, (SELECT COUNT(*) FROM stats) AS stats",
  );
  ok(`${counts?.stats ?? 0} players, ${counts?.fights ?? 0} fights, ${counts?.players ?? 0} fight player rows`);
  if (!counts?.fights) {
    warn("no saved fights. Match history, wins and fight pages need save-all-fights: true (or save-elo-fights: true) in the plugin's config.yml");
  } else {
    const newest = await database.get<{ t: number }>("SELECT MAX(started) AS t FROM fights");
    const days = Math.round((Date.now() - Number(newest?.t)) / 86_400_000);
    ok(`newest fight ${days === 0 ? "today" : `${days} days ago`}`);

    const sample = await database.all<{ fight_data: string | null }>("SELECT fight_data FROM fights ORDER BY id DESC LIMIT 200");
    const readable = sample.filter((r) => parseFightData(r.fight_data).kit).length;
    const players = await database.all<{ player_data: string | null }>("SELECT player_data FROM fight_players ORDER BY fight DESC LIMIT 200");
    const inventories = players.filter((r) => parsePlayerData(r.player_data).inventory).length;
    const line = `of the newest fights: ${readable}/${sample.length} have readable kit data, ${inventories}/${players.length} players have readable inventories`;
    if (readable < sample.length * 0.9 || inventories < players.length * 0.9) warn(`${line}. Unreadable rows still show, just without those details.`);
    else ok(line);
  }

  console.log(problems ? `\n${problems} thing(s) to look at.\n` : "\nAll good.\n");
}

main()
  .catch((err) => {
    console.error(err);
    problems++;
  })
  .finally(async () => {
    await (await db().catch(() => null))?.close();
    process.exit(problems ? 1 : 0);
  });
