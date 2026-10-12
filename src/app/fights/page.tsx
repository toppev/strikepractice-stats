import type { Metadata } from "next";
import Link from "next/link";
import { recentFights } from "@/lib/queries/fights";
import { getKits } from "@/lib/queries/kits";
import { FightList, FightRow, KitLabel } from "@/components/fight-row";
import { pageParam } from "@/components/pagination";

export const metadata: Metadata = { title: "Fights" };

const PAGE_SIZE = 30;

type Props = { searchParams: Promise<{ page?: string; show?: string; kit?: string }> };

export default async function FightsPage({ searchParams }: Props) {
  const query = await searchParams;
  const page = pageParam(query.page);
  const filter = { ranked: query.show === "ranked" ? true : query.show === "unranked" ? false : undefined, kit: query.kit || undefined };
  // One extra row tells whether there is a next page without counting the whole table
  const [rows, kits] = await Promise.all([recentFights(filter, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE), getKits()]);
  const fights = rows.slice(0, PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;
  const kitList = [...kits.values()].filter((k) => k.fights > 0 && !k.hidden).sort((a, b) => b.fights - a.fights);

  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ show: query.show, kit: query.kit, ...changes })) if (v) next.set(k, v);
    const qs = next.toString();
    return `/fights${qs ? `?${qs}` : ""}`;
  };
  const chip = (active: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent/10 text-text" : "border-line text-muted hover:text-text"}`;

  return (
    <div className="pt-10">
      <h1 className="font-display text-6xl font-black">Fights</h1>
      <p className="mt-2 text-muted">Every saved fight, newest first.</p>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {[
          { label: "All", show: undefined },
          { label: "Ranked", show: "ranked" },
          { label: "Unranked", show: "unranked" },
        ].map((f) => (
          <Link key={f.label} href={href({ show: f.show, page: undefined })} aria-current={query.show === f.show ? "true" : undefined} className={chip(query.show === f.show)}>
            {f.label}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {kitList.slice(0, 16).map((k) => (
          <Link
            key={k.name}
            href={href({ kit: query.kit === k.name ? undefined : k.name, page: undefined })}
            aria-current={query.kit === k.name ? "true" : undefined}
            className={`${chip(query.kit === k.name)} pl-1.5`}
          >
            <KitLabel kit={k} name={k.name} size={16} />
            {k.ranked && <span className="text-xs text-accent">Ranked</span>}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <FightList empty="No fights match this filter.">
          {fights.map((f) => (
            <FightRow key={f.id} fight={f} kits={kits} />
          ))}
        </FightList>
      </div>
      <nav aria-label="Pages" className="flex items-center justify-between pt-5">
        {page > 1 ? (
          <Link href={href({ page: page > 2 ? String(page - 1) : undefined })} className="rounded-md border border-line px-3.5 py-1.5 text-sm hover:border-accent hover:text-accent">
            Newer
          </Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link href={href({ page: String(page + 1) })} className="rounded-md border border-line px-3.5 py-1.5 text-sm hover:border-accent hover:text-accent">
            Older
          </Link>
        )}
      </nav>
    </div>
  );
}
