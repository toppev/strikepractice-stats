import { Link } from "@/components/link";
import { SearchBox } from "@/components/search-box";

export default function NotFound() {
  return (
    <div className="max-w-xl py-24">
      <h1 className="font-display text-6xl font-black">Nothing here</h1>
      <p className="mt-4 text-lg text-muted">
        No player, fight or page matches this address. Players show up once they have joined the server; search by their current
        name, an old name or their UUID.
      </p>
      <div className="mt-8">
        <SearchBox size="lg" />
      </div>
      <Link href="/" className="mt-6 inline-block text-accent hover:underline">
        Back to the home page
      </Link>
    </div>
  );
}
