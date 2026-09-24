import { useEffect, useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import { getRecent, RecentProduct, removeRecent } from "../../utils/recent";
import api from "../../utils/api";

type Props = {
  excludeId?: string;
  max?: number;
  title?: string;
};

type OkResult = { ok: true; id: string; product: any };
type ErrResult = { ok: false; id: string };

export default function RecentlyViewed({
  excludeId,
  max = 8,
  title = "Recently viewed",
}: Props) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Load from localStorage and dedupe by _id
      const stored = getRecent(max + 10);
      const byId = new Map<string, RecentProduct>();
      for (const p of stored) {
        if (p && p._id && !byId.has(p._id)) byId.set(p._id, p);
      }
      const ids = Array.from(byId.keys());
      if (ids.length === 0) {
        if (mounted) setItems([]);
        return;
      }

      // Validate against API, prune stale
      const requests: Promise<OkResult | ErrResult>[] = ids.map((id) =>
        api
          .get(`/products/${id}`)
          .then((res) => ({ ok: true as const, id, product: res.data }))
          .catch(() => ({ ok: false as const, id }))
      );

      const results = await Promise.all(requests);

      const valid: RecentProduct[] = [];
      const toRemove: string[] = [];

      for (const r of results) {
        if (r.ok) {
          const prod = r.product;
          if (prod && prod._id) {
            // Include stock to make ProductCard availability accurate
            valid.push({
              _id: prod._id,
              title: prod.title,
              price: prod.price,
              images: prod.images,
              // extra fields commonly used by ProductCard (optional)
              // @ts-ignore keep flexible; ProductCard handles shapes
              stock: prod.stock,
              // @ts-ignore optional extra info
              discountPrice: prod.discountPrice,
              // @ts-ignore optional extra info
              avgRating: prod.avgRating,
              // @ts-ignore optional extra info
              brand: prod.brand,
              // @ts-ignore optional extra info
              tags: prod.tags,
              // @ts-ignore optional extra info
              attributes: prod.attributes,
              // @ts-ignore optional extra info
              seo: prod.seo,
            } as any);
          } else {
            toRemove.push(r.id);
          }
        } else {
          toRemove.push(r.id);
        }
      }

      // Remove stale ids from localStorage
      if (toRemove.length) {
        for (const id of toRemove) removeRecent(id);
      }

      if (!mounted) return;
      setItems(valid.slice(0, max + 2)); // small buffer to allow exclude
    })();

    return () => {
      mounted = false;
    };
  }, [max]);

  const visible = useMemo(() => {
    const filtered = items.filter((p) => p && p._id && p._id !== excludeId);
    // de-dupe by _id just in case
    const map = new Map<string, RecentProduct>();
    for (const p of filtered) if (!map.has(p._id)) map.set(p._id, p);
    return Array.from(map.values()).slice(0, max);
  }, [items, excludeId, max]);

  if (visible.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {visible.map((p) => (
          <ProductCard key={p._id} p={p as any} />
        ))}
      </div>
    </section>
  );
}
