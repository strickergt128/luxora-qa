import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import api from "../utils/api";

const RECENT_SEARCHES_KEY = "luxora_recent_searches";
const MAX_RECENT = 6;

type SearchResults = {
  products?: Array<{ _id: string; title: string }>;
  categories?: Array<{ _id: string; name: string }>;
  sellers?: Array<{ _id: string; name: string }>;
};

const readRecentSearches = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
};

const pushRecentSearch = (query: string) => {
  if (typeof window === "undefined") return;
  const normalized = query.trim();
  if (!normalized) return;
  const next = [
    normalized,
    ...readRecentSearches().filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
  ].slice(0, MAX_RECENT);
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
};

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [trending, setTrending] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  function handleSubmit(e?: React.FormEvent, forcedQuery?: string) {
    if (e) e.preventDefault();
    const nextQuery = (forcedQuery ?? query).trim();
    if (!nextQuery) return;
    pushRecentSearch(nextQuery);
    setRecent(readRecentSearches());
    setShowDropdown(false);
    router.push(`/products?search=${encodeURIComponent(nextQuery)}`);
  }

  useEffect(() => {
    api
      .get("/search/trending")
      .then(({ data }) => setTrending(Array.isArray(data) ? data : []))
      .catch(() => setTrending([]));
    setRecent(readRecentSearches());
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const productResults = results?.products || [];
  const categoryResults = results?.categories || [];
  const sellerResults = results?.sellers || [];
  const hasQuery = query.trim().length > 0;
  const hasAnyResults =
    productResults.length > 0 || categoryResults.length > 0 || sellerResults.length > 0;

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          placeholder="Search products, brands, categories, or sellers"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
          className="w-full border border-border/80 bg-card py-3 pl-4 pr-12 text-sm text-foreground transition-all duration-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-md"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground rounded-md"
          aria-label="Search"
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
        </button>
      </form>

      {showDropdown ? (
        <div className="absolute top-full z-50 mt-3 w-full overflow-hidden border border-border bg-card shadow-[var(--shadow-soft)]">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Searching…</div>
          ) : null}

          {hasQuery && results && !loading ? (
            <div className="divide-y divide-border">
              {productResults.length > 0 ? (
                <div className="p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Products
                  </div>
                  <div className="space-y-1">
                    {productResults.map((product) => (
                      <Link
                        key={product._id}
                        href={`/products/${product._id}`}
                    className="block px-3 py-2 text-sm text-foreground hover:bg-secondary"
                      >
                        {product.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {categoryResults.length > 0 ? (
                <div className="p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Categories
                  </div>
                  <div className="space-y-1">
                    {categoryResults.map((category) => (
                      <button
                        key={category._id}
                        type="button"
                        onMouseDown={() =>
                          router.push(`/products?category=${encodeURIComponent(category.name)}`)
                        }
                        className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {sellerResults.length > 0 ? (
                <div className="p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Sellers
                  </div>
                  <div className="space-y-1">
                    {sellerResults.map((seller) => (
                      <div key={seller._id} className="px-3 py-2 text-sm text-foreground">
                        {seller.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!hasAnyResults ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No matches for “{query}”
                </div>
              ) : null}
            </div>
          ) : null}

          {!hasQuery ? (
            <div className="grid gap-4 p-3 md:grid-cols-2">
              {recent.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Recent searches
                  </div>
                  <div className="space-y-1">
                    {recent.map((item, index) => (
                      <button
                        key={`${item}-${index}`}
                        type="button"
                        onMouseDown={() => {
                          setQuery(item);
                          handleSubmit(undefined, item);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {trending.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Popular right now
                  </div>
                  <div className="space-y-1">
                    {trending.map((item, index) => (
                      <button
                        key={`${item}-${index}`}
                        type="button"
                        onMouseDown={() => {
                          setQuery(item);
                          handleSubmit(undefined, item);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
