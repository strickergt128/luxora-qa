import { useEffect, useState } from "react";
import api from "../../utils/api";
import ProductCard from "./ProductCard";
import ProductCardSkeleton from "./ProductCardSkeleton";

type Props = {
  productId: string;
  limit?: number;
};

export default function AlsoBought({ productId, limit = 8 }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data } = await api.get(`/products/${productId}/also-bought`, {
          params: { limit },
        });
        if (mounted) setItems(data?.items || []);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (productId) load();
    return () => {
      mounted = false;
    };
  }, [productId, limit]);

  if (!loading && items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Shoppers who viewed this also bought
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {Array.from({ length: Math.min(8, limit) }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {items.map((p) => (
            <ProductCard key={p._id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
