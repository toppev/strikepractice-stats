import Link from "next/link";
import { getConfig } from "@/lib/config";
import { getBoardPage, getBoards } from "@/lib/queries/leaderboards";
import { getKits } from "@/lib/queries/kits";
import { recentFights } from "@/lib/queries/fights";
import { getServerSummary } from "@/lib/queries/server";
import { bodyUrl } from "@/lib/images";
import { compactNumber, formatNumber } from "@/lib/format";
import { CopyValue } from "@/components/copy-button";
import { SearchBox } from "@/components/search-box";
import { FightList, FightRow, KitLabel } from "@/components/fight-row";
import { PlayerLink, RankNumber, playerHref } from "@/components/player";
import { ItemIconFor } from "@/components/minecraft";
import { ActivityBars } from "@/components/activity-bars";

export default async function Home({ searchParams }: { searchParams: Promise<{ ladder?: string }> }) {
  const { site } = getConfig();
  const { ladder: ladderParam } = await searchParams;
  const [boards, kits, fights, summary] = await Promise.all([getBoards(), getKits(), recentFights({}, 8), getServerSummary()]);

  const global = boards.find((b) => b.id === "elo")!;
  const ladders = boards.filter((b) => b.group === "ladders");
  const ladder = ladders.find((b) => b.id === ladderParam) ?? ladders[0];
  const [champion, ladderTop] = await Promise.all([
    getBoardPage(global, 1, 1).then((p) => p.rows[0]),
    ladder ? getBoardPage(ladder, 1, 10) : Promise.resolve(null),
  ]);

  return (
    <>
      {/* Hero: who the server is, how to join, and who is on top */}
      <section className="grid grid-cols-1 items-end gap-10 border-b border-line pb-12 pt-12 md:grid-cols-[1fr_auto] md:pt-16">
        <div className="max-w-2xl">
          <h1 className="font-display text-[clamp(3.5rem,9vw,7rem)] leading-[0.85] font-black tracking-tight">{site.name}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{site.tagline}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {site.serverIp && <CopyValue value={site.serverIp} label="Copy IP" />}
          </div>
          <div className="mt-6 max-w-xl">
            <SearchBox size="lg" />
          </div>
        </div>

        {champion && (
          <Link
            href={playerHref(champion)}
            className="group relative mx-auto flex w-56 flex-col items-center md:mx-0"
            aria-label={`${champion.name}, number one on the global ladder with ${champion.value} elo`}
          >
            <div
              className="absolute bottom-10 h-40 w-48 rounded-[50%] opacity-60 blur-2xl"
              style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
              aria-hidden
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bodyUrl(champion, 320)} alt="" width={160} height={260} className="pixelated relative h-[260px] w-auto drop-shadow-2xl" />
            <div className="relative -mt-2 w-full rounded-lg border border-accent/50 bg-surface px-4 py-3 text-center">
              <div className="text-sm text-accent">Number one, global elo</div>
              <div className="truncate font-display text-3xl font-extrabold group-hover:text-accent">{champion.name}</div>
              <div className="num text-muted">{formatNumber(champion.value)} elo</div>
            </div>
          </Link>
        )}
      </section>

      <div className="grid grid-cols-1 gap-x-14 gap-y-16 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Ladders */}
        <section aria-labelledby="ladders-title">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="ladders-title" className="font-display text-4xl font-extrabold">
              Ladders
            </h2>
            <Link href={ladder ? `/leaderboards/${ladder.id}` : "/leaderboards"} className="text-sm text-accent hover:underline">
              Full leaderboard
            </Link>
          </div>
          {ladders.length > 0 ? (
            <>
              <div className="mt-4 flex flex-wrap gap-1.5" role="list" aria-label="Ranked kits">
                {ladders.map((b) => (
                  <Link
                    key={b.id}
                    role="listitem"
                    href={`/?ladder=${encodeURIComponent(b.id)}`}
                    scroll={false}
                    aria-current={b.id === ladder?.id ? "true" : undefined}
                    className={`flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-3 text-sm ${
                      b.id === ladder?.id ? "border-accent bg-accent/10 text-text" : "border-line text-muted hover:text-text"
                    }`}
                  >
                    {b.kit?.icon && <ItemIconFor item={b.kit.icon} size={18} />}
                    {b.label}
                  </Link>
                ))}
              </div>
              <ol className="mt-5">
                {ladderTop?.rows.map((row) => (
                  <li key={row.uuid} className="flex items-center gap-4 border-b border-line/60 py-2.5">
                    <RankNumber rank={row.rank} className="w-6 text-right" />
                    <PlayerLink player={row} />
                    <span className="num ml-auto text-sm text-muted">
                      {row.wins !== undefined && row.wins + (row.losses ?? 0) > 0 && `${row.wins}–${row.losses}`}
                    </span>
                    <span className="num w-14 text-right font-semibold">{formatNumber(row.value)}</span>
                  </li>
                ))}
                {ladderTop?.rows.length === 0 && <li className="py-6 text-muted">Nobody has played this ladder yet.</li>}
              </ol>
            </>
          ) : (
            <p className="mt-4 text-muted">No ranked kits yet. Ladders show up here once players finish ranked fights.</p>
          )}
        </section>

        {/* Latest fights */}
        <section aria-labelledby="fights-title">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="fights-title" className="font-display text-4xl font-extrabold">
              Latest fights
            </h2>
            <Link href="/fights" className="text-sm text-accent hover:underline">
              All fights
            </Link>
          </div>
          <div className="mt-4">
            <FightList empty="No fights recorded yet. Fights are saved when save-all-fights is on in the plugin's config.yml.">
              {fights.map((f) => (
                <FightRow key={f.id} fight={f} kits={kits} />
              ))}
            </FightList>
          </div>
        </section>
      </div>

      {/* Server activity */}
      {summary.newest && (
        <section aria-labelledby="activity-title" className="mt-20 grid gap-10 border-t border-line pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <h2 id="activity-title" className="font-display text-4xl font-extrabold">
              Server activity
            </h2>
            <dl className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <dt className="text-sm text-muted">Fights recorded</dt>
                <dd className="text-3xl font-semibold">{compactNumber(summary.fights)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Players</dt>
                <dd className="text-3xl font-semibold">{compactNumber(summary.players)}</dd>
              </div>
            </dl>
            {summary.popularKits.length > 0 && (
              <>
                <h3 className="mt-10 text-sm text-muted">Most played kits, last 26 weeks</h3>
                <ol className="mt-3 space-y-2">
                  {summary.popularKits.slice(0, 5).map((k) => {
                    const share = k.fights / summary.popularKits[0].fights;
                    return (
                      <li key={k.kit} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                        <KitLabel kit={kits.get(k.kit)} name={k.kit} size={18} />
                        <span className="h-2 rounded-full bg-surface-2">
                          <span className="block h-2 rounded-full bg-muted/70" style={{ width: `${share * 100}%` }} />
                        </span>
                        <span className="num w-12 text-right text-muted">{formatNumber(k.fights)}</span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
          <div className="pl-10">
            <h3 className="text-sm text-muted">Fights per week, last 26 weeks</h3>
            <div className="mt-6">
              <ActivityBars weeks={summary.perWeek} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
