"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import ContentModal from "./ContentModal";

export interface ContentCardItem {
  key: string;
  name: string;
  coverImage: string;
  abstract: string;
  description: string;
  gallery: string[];
  badges?: string[];
}

export default function ContentGrid({
  items,
  searchPlaceholder,
}: {
  items: ContentCardItem[];
  searchPlaceholder: string;
}) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ContentCardItem | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      [item.name, item.abstract, item.description, ...(item.badges || [])].some((text) =>
        text?.toLowerCase().includes(query)
      )
    );
  }, [items, search]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-8 pb-24">
      <div className="relative mx-auto mb-10 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-red"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-white/50">No matches found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item)}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition hover:border-red/40 hover:bg-white/[0.06]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/5">
                <Image
                  src={item.coverImage}
                  alt={item.name}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="line-clamp-1 font-bold text-white">{item.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-white/60">{item.abstract || item.description}</p>
                {item.badges && item.badges.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.badges.slice(0, 4).map((badge) => (
                      <span key={badge} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <ContentModal item={active} onClose={() => setActive(null)} />
    </div>
  );
}
