import type { Metadata } from "next";
import { Link } from "@/components/link";
import { notFound, redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { getFight, getFightIdByStart, type FightDetail } from "@/lib/queries/fights";
import { getKits } from "@/lib/queries/kits";
import { arenaImage, bodyUrl } from "@/lib/images";
import { duration, formatDateTime, signed, timeAgo } from "@/lib/format";
import { stripFormatting } from "@/lib/sp/colors";
import { titleCase } from "@/lib/sp/items";
import { EffectList, Hearts, Hunger, Inventory, ItemIconFor } from "@/components/minecraft";
import { PlayerHead, playerHref } from "@/components/player";
import { CopyValue } from "@/components/copy-button";

type Props = { params: Promise<{ id: string }> };

function fightNumber(id: string): number | null {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function load(id: string): Promise<FightDetail | null> {
  const n = fightNumber(id);
  return n ? getFight(n) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const fight = await load((await params).id);
  if (!fight) return { title: "Fight not found" };
  const w = fight.winners.map((p) => p.name).join(", ");
  const l = fight.losers.map((p) => p.name).join(", ");
  return { title: `${w} vs ${l}` };
}

const MODES: Record<string, string> = {
  DUEL: "Unranked",
  DUEL_QUEUE: "Unranked queue",
  DUEL_QUEUE_RANKED: "Ranked",
  DUEL_QUEUE_PREMIUM: "Premium ranked",
};

type Player = FightDetail["players"][number];

export default async function FightPage({ params }: Props) {
  const { id } = await params;
  const fight = await load(id);
  if (!fight) {
    // Links from the plugin carry the fight's start time instead of its id
    const n = fightNumber(id);
    const real = n ? await getFightIdByStart(n) : null;
    if (real) redirect(`/fight/${real}`);
    notFound();
  }
  const kits = await getKits();
  const config = getConfig();

  const kit = kits.get(fight.kit);
  const kitName = kit?.label ?? stripFormatting(fight.data.kit?.displayName) ?? titleCase(fight.kit);
  const icon = kit?.icon ?? fight.data.kit?.icon ?? null;
  const arenaKey = stripFormatting(fight.arena).toLowerCase();
  const arena = config.arenas[arenaKey];
  const arenaName = arena?.name ?? (stripFormatting(fight.arena) || undefined);
  const banner = arenaImage(arenaKey);

  const [a, b] = fight.players;
  const duel = fight.players.length === 2;

  return (
    <article>
      {/* Header band: what was fought, where, when; then the two fighters facing each other */}
      <header className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-b border-line">
        {banner && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/55 to-bg" />
          </>
        )}
        <div className="relative mx-auto max-w-[1180px] px-4 pt-10 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
            <span className="flex items-center gap-2.5 text-text">
              {icon && <ItemIconFor item={icon} size={28} />}
              <span className="font-display text-3xl font-extrabold">{kitName}</span>
            </span>
            <span className={fight.ranked ? "rounded-full border border-accent/50 px-2.5 py-0.5 text-sm text-accent" : "text-sm"}>
              {MODES[fight.mode ?? ""] ?? titleCase((fight.mode ?? "fight").toLowerCase())}
            </span>
            {fight.data.kit && fight.data.kit.bestOf > 1 && <span className="text-sm">Best of {fight.data.kit.bestOf}</span>}
            {arenaName && <span className="text-sm">{arenaName}</span>}
            <time className="text-sm" dateTime={new Date(fight.started).toISOString()} title={timeAgo(fight.started)}>
              {formatDateTime(fight.started)}
            </time>
            <span className="num text-sm">Lasted {duration(fight.ended - fight.started)}</span>
          </div>

          {duel ? (
            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-4">
              <Fighter player={a} side="left" />
              <span className="pb-10 font-display text-2xl font-black text-faint sm:text-4xl">vs</span>
              <Fighter player={b} side="right" />
            </div>
          ) : (
            <div className="mt-6 grid gap-6 pb-8 sm:grid-cols-2">
              <TeamList title="Winners" players={fight.players.filter((p) => p.winner)} />
              <TeamList title="Losers" players={fight.players.filter((p) => !p.winner)} />
            </div>
          )}
        </div>
      </header>

      {duel && <TaleOfTheTape a={a} b={b} />}

      {/* Inventories as they were when the fight ended */}
      <section aria-labelledby="inv-title" className="mt-14">
        <h2 id="inv-title" className="font-display text-4xl font-extrabold">
          Inventories at the end
        </h2>
        <div className="mt-6 grid gap-10 xl:grid-cols-2">
          {fight.players.map((p) => (
            <div key={p.uuid} className="min-w-0">
              <h3 className="mb-3 flex items-center gap-2.5 text-lg">
                <PlayerHead player={p} size={24} />
                <Link href={playerHref(p)} className="hover:text-accent">
                  {p.name}
                </Link>
                <span className={`text-sm ${p.winner ? "text-win" : "text-loss"}`}>{p.winner ? "Won" : "Lost"}</span>
              </h3>
              {p.data.inventory ? (
                <>
                  <Inventory inventory={p.data.inventory} />
                  {p.data.inventory.effects.length > 0 && (
                    <div className="mt-4">
                      <EffectList effects={p.data.inventory.effects} />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted">This fight didn&apos;t save an inventory for {p.name}.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {fight.data.replayId && (
        <section aria-labelledby="replay-title" className="mt-14 border-t border-line pt-8">
          <h2 id="replay-title" className="text-lg font-semibold">
            Watch the replay
          </h2>
          <p className="mt-1 mb-4 text-muted">Run this on the server while the replay is still stored there.</p>
          <CopyValue value={`/replay ${fight.data.replayId}`} label="Copy command" />
        </section>
      )}
    </article>
  );
}

function Fighter({ player, side }: { player: Player; side: "left" | "right" }) {
  const right = side === "right";
  return (
    <Link href={playerHref(player)} className={`group flex items-end gap-3 sm:gap-5 ${right ? "flex-row-reverse text-right" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bodyUrl(player, 260)}
        alt=""
        width={100}
        height={162}
        className={`pixelated hidden h-[162px] w-auto drop-shadow-xl sm:block ${right ? "-scale-x-100" : ""} ${player.winner ? "" : "opacity-80 grayscale-[35%]"}`}
      />
      <div className="min-w-0 pb-8">
        <div className={`text-sm font-semibold ${player.winner ? "text-win" : "text-loss"}`}>{player.winner ? "Winner" : "Defeated"}</div>
        <div className="truncate font-display text-[clamp(1.75rem,5vw,3.25rem)] leading-none font-black group-hover:text-accent">{player.name}</div>
        {player.eloChange !== null && (
          <div className="num mt-1.5 text-muted">
            <span className={player.eloChange >= 0 ? "text-win" : "text-loss"}>{signed(player.eloChange)}</span> to {player.newElo} elo
          </div>
        )}
      </div>
    </Link>
  );
}

function TeamList({ title, players }: { title: string; players: Player[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm text-muted">{title}</h2>
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.uuid}>
            <Link href={playerHref(p)} className="flex items-center gap-2.5 text-xl hover:text-accent">
              <PlayerHead player={p} size={28} />
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The fight's numbers side by side. Each row's bar splits by share, so the side that did more
 * owns more of it; "better" decides which number is bright (fewer missed potions is better).
 */
function TaleOfTheTape({ a, b }: { a: Player; b: Player }) {
  const sa = a.data.stats;
  const sb = b.data.stats;
  const ia = a.data.inventory;
  const ib = b.data.inventory;
  type Row = { label: string; a: number | null; b: number | null; format?: (n: number) => string; lowerIsBetter?: boolean };
  const rows: Row[] = [
    { label: "Hits", a: sa?.hits ?? null, b: sb?.hits ?? null },
    { label: "Longest combo", a: sa?.longestCombo ?? null, b: sb?.longestCombo ?? null },
  ];
  const threw = (sa?.potionsThrown ?? 0) + (sb?.potionsThrown ?? 0) > 0;
  if (threw) {
    rows.push(
      { label: "Potions thrown", a: sa?.potionsThrown ?? null, b: sb?.potionsThrown ?? null, lowerIsBetter: true },
      { label: "Potions missed", a: sa?.potionsMissed ?? null, b: sb?.potionsMissed ?? null, lowerIsBetter: true },
      { label: "Potion accuracy", a: sa?.potionAccuracy ?? null, b: sb?.potionAccuracy ?? null, format: (n) => `${n}%` },
    );
  }
  const kindA = ia?.remaining.kind;
  const kindB = ib?.remaining.kind;
  if (kindA || kindB) {
    const label = (kindA ?? kindB) === "soups" ? "Soups left" : "Potions left";
    rows.push({ label, a: ia?.remaining.count ?? 0, b: ib?.remaining.count ?? 0 });
  }

  return (
    <section aria-labelledby="tape-title" className="mt-12">
      <h2 id="tape-title" className="sr-only">
        Fight statistics
      </h2>
      <div className="mx-auto max-w-3xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-1 border-b border-line pb-5">
          <HealthSide inv={ia} align="left" />
          <span className="text-center text-sm text-muted">Health</span>
          <HealthSide inv={ib} align="right" />
        </div>
        <dl>
          {rows.map((row) => {
            const va = row.a ?? 0;
            const vb = row.b ?? 0;
            const total = va + vb;
            const better = va === vb ? 0 : (va > vb) !== !!row.lowerIsBetter ? -1 : 1;
            const fmt = (v: number | null) => (v === null ? "–" : row.format ? row.format(v) : String(v));
            return (
              <div key={row.label} className="grid grid-cols-[3.5rem_1fr_auto_1fr_3.5rem] items-center gap-x-3 border-b border-line/60 py-3">
                <dd className={`num text-right text-xl font-semibold ${better === -1 ? "text-text" : "text-muted"}`}>{fmt(row.a)}</dd>
                <span className="flex h-1.5 justify-end rounded-full bg-surface-2" aria-hidden>
                  <span className={`h-1.5 rounded-full ${better === -1 ? "bg-accent" : "bg-muted/60"}`} style={{ width: total ? `${(va / total) * 100}%` : 0 }} />
                </span>
                <dt className="w-32 text-center text-sm text-muted">{row.label}</dt>
                <span className="flex h-1.5 rounded-full bg-surface-2" aria-hidden>
                  <span className={`h-1.5 rounded-full ${better === 1 ? "bg-accent" : "bg-muted/60"}`} style={{ width: total ? `${(vb / total) * 100}%` : 0 }} />
                </span>
                <dd className={`num text-left text-xl font-semibold ${better === 1 ? "text-text" : "text-muted"}`}>{fmt(row.b)}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

function HealthSide({ inv, align }: { inv: Player["data"]["inventory"]; align: "left" | "right" }) {
  if (!inv) return <span className={align === "right" ? "text-left text-muted" : "text-right text-muted"}>–</span>;
  // Both sides fill outward from the middle, so the two bars mirror each other
  const reverse = align === "left";
  return (
    <div className={`flex flex-col gap-1 ${align === "left" ? "items-end" : "items-start"}`}>
      <Hearts health={inv.health} reverse={reverse} />
      <Hunger food={inv.food} reverse={reverse} />
      <span className="text-sm text-muted">{inv.dead ? "Died" : `${Math.ceil(inv.health) / 2} hearts left`}</span>
    </div>
  );
}
