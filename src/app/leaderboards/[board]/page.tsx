import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfig } from "@/lib/config";
import { getBoardPage, getBoards, type Board } from "@/lib/queries/leaderboards";
import { formatNumber, percent } from "@/lib/format";
import { ItemIconFor } from "@/components/minecraft";
import { PlayerLink, RankNumber } from "@/components/player";
import { Pagination, pageParam } from "@/components/pagination";

type Props = { params: Promise<{ board: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { board: id } = await params;
  const board = (await getBoards()).find((b) => b.id === decodeURIComponent(id));
  return { title: board ? `${board.label} leaderboard` : "Leaderboards" };
}

const GROUPS: { id: Board["group"]; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "ladders", label: "Ranked ladders" },
  { id: "events", label: "Events" },
];

export default async function LeaderboardPage({ params, searchParams }: Props) {
  const [{ board: rawId }, { page: rawPage }] = await Promise.all([params, searchParams]);
  const boards = await getBoards();
  const board = boards.find((b) => b.id === decodeURIComponent(rawId));
  if (!board) notFound();

  const pageSize = getConfig().leaderboards.pageSize;
  const page = pageParam(rawPage);
  const { rows, total } = await getBoardPage(board, page, pageSize);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const isLadder = board.group === "ladders";

  return (
    <div className="grid grid-cols-1 gap-10 pt-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
      <nav aria-label="Leaderboards" className="lg:sticky lg:top-6 lg:self-start">
        {GROUPS.map((group) => {
          const list = boards.filter((b) => b.group === group.id);
          if (list.length === 0) return null;
          return (
            <div key={group.id} className="mb-6">
              <h2 className="mb-2 text-sm text-faint">{group.label}</h2>
              <ul className="flex flex-wrap gap-1 lg:flex-col">
                {list.map((b) => {
                  const active = b.id === board.id;
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/leaderboards/${encodeURIComponent(b.id)}`}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[15px] ${
                          active ? "bg-surface-2 text-text" : "text-muted hover:text-text"
                        }`}
                      >
                        {b.kit?.icon && <ItemIconFor item={b.kit.icon} size={18} />}
                        {b.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <section aria-labelledby="board-title" className="min-w-0">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-line pb-5">
          {board.kit?.icon && <ItemIconFor item={board.kit.icon} size={44} />}
          <div>
            <h1 id="board-title" className="font-display text-5xl leading-none font-black">
              {board.label}
            </h1>
            <p className="mt-2 text-muted">
              {isLadder ? "Ranked elo in this kit. " : ""}
              {formatNumber(total)} {total === 1 ? "player" : "players"} on the board.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-10 text-muted">Nobody is on this board yet.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-left">
            <thead>
              <tr className="text-sm text-faint">
                <th scope="col" className="w-14 py-3 pr-2 text-right font-normal">
                  Rank
                </th>
                <th scope="col" className="py-3 pl-4 font-normal">
                  Player
                </th>
                {isLadder && (
                  <th scope="col" className="hidden py-3 text-right font-normal sm:table-cell">
                    Won–lost
                  </th>
                )}
                {isLadder && (
                  <th scope="col" className="hidden py-3 text-right font-normal md:table-cell">
                    Win rate
                  </th>
                )}
                <th scope="col" className="py-3 pr-1 text-right font-normal capitalize">
                  {board.unit}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const played = (row.wins ?? 0) + (row.losses ?? 0);
                return (
                  <tr key={row.uuid} className="border-t border-line/60 hover:bg-surface">
                    <td className="py-2.5 pr-2 text-right">
                      <RankNumber rank={row.rank} />
                    </td>
                    <td className="max-w-0 py-2.5 pl-4">
                      <PlayerLink player={row} size={28} className="text-[17px]" />
                    </td>
                    {isLadder && (
                      <td className="num hidden py-2.5 text-right text-muted sm:table-cell">{played > 0 ? `${row.wins}–${row.losses}` : "–"}</td>
                    )}
                    {isLadder && (
                      <td className="num hidden py-2.5 text-right text-muted md:table-cell">{percent(row.wins ?? 0, played)}</td>
                    )}
                    <td className="num py-2.5 pr-1 text-right text-lg font-semibold">{formatNumber(row.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pages={pages} href={(p) => `/leaderboards/${encodeURIComponent(board.id)}${p > 1 ? `?page=${p}` : ""}`} />
      </section>
    </div>
  );
}
