import LeaderboardPage, { generateMetadata as boardMetadata } from "./[board]/page";

// /leaderboards shows the global elo board
export async function generateMetadata() {
  return boardMetadata({ params: Promise.resolve({ board: "elo" }), searchParams: Promise.resolve({}) });
}

export default async function Leaderboards({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return <LeaderboardPage params={Promise.resolve({ board: "elo" })} searchParams={searchParams} />;
}
