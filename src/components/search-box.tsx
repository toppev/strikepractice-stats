"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Suggestion = { uuid: string; name: string; head: string };

/**
 * Player search with suggestions from /api/search. Enter opens the typed name even when it
 * isn't suggested: the profile page also finds players by an old name or a UUID.
 */
export function SearchBox({ size = "md", autoFocus = false }: { size?: "md" | "lg"; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const request = useRef(0);
  // Answers already fetched, so backspacing or retyping a name doesn't ask again
  const seen = useRef(new Map<string, Suggestion[]>());

  useEffect(() => {
    const q = query.trim();
    // Any answer still on its way is for older text now
    const id = ++request.current;
    if (!/^[A-Za-z0-9_]{1,16}$/.test(q)) {
      setSuggestions([]);
      return;
    }
    const known = seen.current.get(q.toLowerCase());
    if (known) {
      setSuggestions(known);
      setActive(-1);
      return;
    }
    // Asks once typing pauses, not on every key: most people type slower than a short delay
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return; // e.g. rate limited: keep what's shown
        const data = (await res.json()) as { players: Suggestion[] };
        seen.current.set(q.toLowerCase(), data.players);
        if (id === request.current) {
          setSuggestions(data.players);
          setActive(-1);
        }
      } catch {
        // Suggestions are a convenience; Enter still works
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const go = (name: string) => {
    const target = name.trim();
    if (!target) return;
    setOpen(false);
    router.push(`/player/${encodeURIComponent(target)}`);
  };

  const big = size === "lg";
  const showList = open && suggestions.length > 0;

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        go(active >= 0 ? suggestions[active].name : query);
      }}
    >
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Find a player
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder="Find a player"
        value={query}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`w-full rounded-lg border border-line bg-surface-2 text-text placeholder:text-faint focus:border-accent focus:outline-none ${
          big ? "h-14 px-5 text-lg" : "h-10 px-3.5 text-[15px]"
        }`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border border-line bg-surface shadow-2xl shadow-black/40"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.uuid}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(s.name);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 ${i === active ? "bg-surface-2 text-accent" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.head} alt="" width={22} height={22} className="pixelated rounded-[3px]" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
