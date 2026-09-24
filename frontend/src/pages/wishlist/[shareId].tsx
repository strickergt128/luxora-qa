import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ProductCard from "../../components/products/ProductCard";
import api from "../../utils/api";

export default function PublicWishlistPage() {
  const router = useRouter();
  const { shareId } = router.query as { shareId: string };
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shareId) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/wishlist/share/${shareId}`);
        setItems(data?.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [shareId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600">Loading saved items…</p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          This saved-items link is unavailable
        </h1>
        <p className="text-gray-600">The link may be turned off or there may be no items to show.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Shared saved items</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((p) => (
          <ProductCard key={p._id} p={p} />
        ))}
      </div>
    </div>
  );
}
