import type { Metadata } from "next";
import { Link } from "@/components/link";
import { notFound, redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { bodyUrl } from "@/lib/images";
import { formatDate, formatNumber, percent, ratio, timeAgo } from "@/lib/format";
import {
  findPlayer,
  getEloHistory,
  getKitRecords,
  getNameHistory,
  getPlacements,
  getPlayerRecord,
  getPlayerStats,
  getRivals,
  getStreaks,
} from "@/lib/queries/players";
import { countPlayerFights, playerFights, type FightFilter } from "@/lib/queries/fights";
import { getKits } from "@/lib/queries/kits";
import { getBoards } from "@/lib/queries/leaderboards";
import { FightList, FightRow, KitLabel } from "@/components/fight-row";
import { ItemIconFor } from "@/components/minecraft";
import { PlayerHead, playerHref } from "@/components/player";
import { Pagination, oneParam, pageParam } from "@/components/pagination";
import { EloChart, type EloSeries } from "@/components/elo-chart";

type Props = {
  // Next.js has already decoded these; decoding again would break on a literal "%"
  params: Promise<{ name: string }>;
  searchParams: Promise<{ page?: string | string[]; show?: string | string[]; kit?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const player = await findPlayer((await params).name);
  return { title: player ? player.name : "Player not found" };
}

const PAGE_SIZE = 15;

export default async function PlayerPage({ params, searchParams }: Props) {
  const [{ name: requested }, search] = await Promise.all([params, searchParams]);
  const query = { show: oneParam(search.show), kit: oneParam(search.kit), page: oneParam(search.page) };
  const player = await findPlayer(requested);
  if (!player) notFound();
  // One address per player: UUIDs, old names and odd casing all land on the current name
  if (player.name !== requested) {
    const kept = Object.entries(query).filter((entry): entry is [string, string] => !!entry[1]);
    const qs = new URLSearchParams(kept).toString();
    redirect(`${playerHref(player)}${qs ? `?${qs}` : ""}`);
  }

  const filter: FightFilter = {
    ranked: query.show === "ranked" ? true : query.show === "unranked" ? false : undefined,
    kit: query.kit,
  };
  const page = pageParam(query.page);

  const [stats, record, streaks, kitRecords, rivals, names, eloHistory, kits, boards, fights, fightCount] = await Promise.all([
    getPlayerStats(player.uuid),
    getPlayerRecord(player.uuid),
    getStreaks(player.uuid),
    getKitRecords(player.uuid),
    getRivals(player.uuid),
    getNameHistory(player.uuid),
    getEloHistory(player.uuid),
    getKits(),
    getBoards(),
    playerFights(player.uuid, filter, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    countPlayerFights(player.uuid, filter),
  ]);
  const placements = stats ? await getPlacements(stats) : {};
  const ladders = boards.flatMap((b) => (b.group === "ladders" && b.kit ? [b.kit] : []));
  const placedLadders = ladders.filter((k) => placements[k.name]);
  const unplacedLadders = ladders.filter((k) => !placements[k.name]);
  const startingElo = getConfig().startingElo;
  const oldNames = names.filter((n) => n.name.toLowerCase() !== player.name.toLowerCase());
  const visibleKitRecords = kitRecords.filter((r) => !kits.get(r.kit)?.hidden);

  const series: EloSeries[] = Object.entries(eloHistory)
    .filter(([kit]) => !kits.get(kit)?.hidden)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([kit, points]) => ({ kit, label: kits.get(kit)?.label ?? kit, points }));

  const events = stats
    ? [
        { label: "Last man standing", value: stats.events.lms },
        { label: "Brackets", value: stats.events.brackets },
        { label: "Sumo event", value: stats.events.sumo },
        { label: "Juggernaut", value: stats.events.juggernaut },
        { label: "Party vs party", value: stats.events.partyVsParty },
      ].filter((e) => e.value > 0)
    : [];

  const filterHref = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { show: query.show, kit: query.kit, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const qs = next.toString();
    return `${playerHref(player)}${qs ? `?${qs}` : ""}#matches`;
  };
  const global = placements.global;

  return (
    <>
      {/* Hero */}
      <section className="grid grid-cols-1 items-end gap-x-10 gap-y-6 border-b border-line pt-10 sm:grid-cols-[auto_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bodyUrl(player, 300)}
          alt=""
          width={130}
          height={210}
          className="pixelated -mb-px hidden h-[210px] w-auto drop-shadow-xl sm:block"
        />
        <div className="pb-8">
          <div className="flex items-center gap-3 sm:hidden">
            <PlayerHead player={player} size={40} />
          </div>
          <h1 className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] font-black tracking-tight break-all">{player.name}</h1>
          {oldNames.length > 0 && (
            <p className="mt-2 text-muted">Also played as {oldNames.map((n) => n.name).join(", ")}</p>
          )}
          <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            {stats && (
              <div>
                <span className="text-4xl font-semibold">{formatNumber(stats.globalElo)}</span>
                <span className="ml-2 text-muted">global elo</span>
              </div>
            )}
            {global && (
              <Link href="/leaderboards/elo" className="text-lg hover:text-accent">
                <span className={global.rank <= 3 ? "text-accent" : ""}>#{formatNumber(global.rank)}</span>
                <span className="text-muted"> of {formatNumber(global.of)} ranked players</span>
              </Link>
            )}
            {record.last && <span className="text-muted">Last fight {timeAgo(record.last)}</span>}
          </div>
        </div>
      </section>

      {/* The numbers: one row, read left to right */}
      <dl className="grid grid-cols-1 grid-cols-2 gap-y-6 border-b border-line py-8 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Wins", value: formatNumber(record.wins) },
          { label: "Losses", value: formatNumber(record.losses) },
          { label: "Win rate", value: percent(record.wins, record.fights) },
          {
            label: "Win streak",
            value: formatNumber(streaks.current),
            note: streaks.best > streaks.current ? `best ${formatNumber(streaks.best)}` : undefined,
          },
          { label: "Kills", value: formatNumber(stats?.kills ?? 0) },
          { label: "Deaths", value: formatNumber(stats?.deaths ?? 0) },
          { label: "K/D", value: ratio(stats?.kills ?? 0, stats?.deaths ?? 0) },
        ].map((s) => (
          <div key={s.label} className="border-line pr-4 lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-[28px] leading-none font-semibold">
              {s.value}
              {s.note && <span className="ml-2 align-middle text-sm font-normal text-muted">{s.note}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-x-14 gap-y-14 pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Ladders */}
        <section aria-labelledby="ladders-title">
          <h2 id="ladders-title" className="font-display text-4xl font-extrabold">
            Ranked ladders
          </h2>
          {placedLadders.length > 0 ? (
            <ul className="mt-4">
              {placedLadders.map((kit) => {
                const place = placements[kit.name];
                const rec = kitRecords.find((r) => r.kit === kit.name);
                return (
                  <li key={kit.name} className="flex items-center gap-3 border-b border-line/60 py-2.5">
                    <Link href={`/leaderboards/${encodeURIComponent(kit.name)}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-accent">
                      {kit.icon ? <ItemIconFor item={kit.icon} size={24} /> : <span className="w-6" />}
                      <span className="truncate">{kit.label}</span>
                    </Link>
                    <span className="num hidden w-14 text-right text-sm text-muted sm:inline">{rec ? `${rec.wins}–${rec.fights - rec.wins}` : ""}</span>
                    <span className={`num w-24 text-right text-sm ${place.rank <= 3 ? "text-accent" : "text-muted"}`}>
                      #{formatNumber(place.rank)} of {formatNumber(place.of)}
                    </span>
                    <span className="num w-14 text-right font-semibold">{formatNumber(stats?.elo[kit.name] ?? startingElo)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-muted">Not on any ranked ladder yet. Players appear on a ladder after their first ranked fight in that kit.</p>
          )}
          {placedLadders.length > 0 && unplacedLadders.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              Not ranked yet in {unplacedLadders.map((k) => k.label).join(", ")}.
            </p>
          )}
          {events.length > 0 && (
            <>
              <h3 className="mt-10 text-sm text-muted">Event wins</h3>
              <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                {events.map((e) => (
                  <div key={e.label}>
                    <dt className="text-sm text-muted">{e.label}</dt>
                    <dd className="text-xl font-semibold">{formatNumber(e.value)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>

        {/* Elo history */}
        <section aria-labelledby="elo-title" className="min-w-0">
          <h2 id="elo-title" className="font-display text-4xl font-extrabold">
            Elo over time
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted">After each ranked fight, newest on the right. Click a point to open the fight.</p>
          <EloChart series={series} startingElo={startingElo} />
        </section>

        {/* Kits */}
        <section aria-labelledby="kits-title">
          <h2 id="kits-title" className="font-display text-4xl font-extrabold">
            Kits played
          </h2>
          {visibleKitRecords.length > 0 ? (
            <>
              <p className="mt-1 flex gap-4 text-sm text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-win" /> Wins
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-loss" /> Losses
                </span>
              </p>
              <ul className="mt-4 space-y-2.5">
                {visibleKitRecords.slice(0, 10).map((r) => {
                  const max = visibleKitRecords[0].fights;
                  const losses = r.fights - r.wins;
                  return (
                    <li key={r.kit} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-3 text-sm">
                      <KitLabel kit={kits.get(r.kit)} name={r.kit} size={18} markRanked />
                      <span className="flex h-3 gap-[2px]" style={{ width: `${Math.max(4, (r.fights / max) * 100)}%` }} title={`${r.wins} wins, ${losses} losses`}>
                        {r.wins > 0 && <span className="h-3 rounded-l-sm bg-win/85 last:rounded-r-sm" style={{ flexGrow: r.wins }} />}
                        {losses > 0 && <span className="h-3 rounded-r-sm bg-loss/85 first:rounded-l-sm" style={{ flexGrow: losses }} />}
                      </span>
                      <span className="num text-right text-muted">
                        {r.wins}–{losses}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-muted">No saved fights yet.</p>
          )}
        </section>

        {/* Rivals */}
        <section aria-labelledby="rivals-title">
          <h2 id="rivals-title" className="font-display text-4xl font-extrabold">
            Most fought
          </h2>
          {rivals.length > 0 ? (
            <ul className="mt-4">
              {rivals.map((r) => (
                <li key={r.uuid} className="flex items-center gap-3 border-b border-line/60 py-2.5">
                  <Link href={playerHref(r)} className="flex min-w-0 flex-1 items-center gap-3 hover:text-accent">
                    <PlayerHead player={r} size={28} />
                    <span className="truncate">{r.name}</span>
                  </Link>
                  <span className="text-sm text-muted">{formatNumber(r.fights)} fights</span>
                  <span className="num w-20 text-right">
                    <span className="text-win">{r.wins}</span>
                    <span className="text-faint">–</span>
                    <span className="text-loss">{r.fights - r.wins}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted">No saved fights yet.</p>
          )}
        </section>
      </div>

      {/* Match history */}
      <section id="matches" aria-labelledby="matches-title" className="mt-16 scroll-mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="matches-title" className="font-display text-4xl font-extrabold">
            Match history
          </h2>
          {record.first && <span className="text-sm text-muted">First fight {formatDate(record.first)}</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[
            { label: "All", show: undefined },
            { label: "Ranked", show: "ranked" },
            { label: "Unranked", show: "unranked" },
          ].map((f) => (
            <Link
              key={f.label}
              href={filterHref({ show: f.show, page: undefined })}
              aria-current={query.show === f.show ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                query.show === f.show ? "border-accent bg-accent/10 text-text" : "border-line text-muted hover:text-text"
              }`}
            >
              {f.label}
            </Link>
          ))}
          <span className="mx-1 w-px self-stretch bg-line" />
          {visibleKitRecords.slice(0, 8).map((r) => (
            <Link
              key={r.kit}
              href={filterHref({ kit: query.kit === r.kit ? undefined : r.kit, page: undefined })}
              aria-current={query.kit === r.kit ? "true" : undefined}
              className={`flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3 text-sm ${
                query.kit === r.kit ? "border-accent bg-accent/10 text-text" : "border-line text-muted hover:text-text"
              }`}
            >
              <KitLabel kit={kits.get(r.kit)} name={r.kit} size={16} markRanked />
            </Link>
          ))}
        </div>
        <div className="mt-4">
          <FightList empty="No fights match this filter.">
            {fights.map((f) => (
              <FightRow key={f.id} fight={f} kits={kits} perspective={player.uuid} absoluteDates />
            ))}
          </FightList>
          <Pagination page={page} pages={Math.ceil(fightCount / PAGE_SIZE)} href={(p) => filterHref({ page: p > 1 ? String(p) : undefined })} />
        </div>
      </section>
    </>
  );
}
