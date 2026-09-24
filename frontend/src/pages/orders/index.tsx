import Link from "next/link";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import { fetchMyOrders } from "../../store/slices/orderSlice";
import { currency, shortDate } from "../../utils/format";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import { getImageUrl } from "../../utils/images";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    confirmed: "bg-primary/15 text-primary border-primary/25",
    shipped: "bg-primary/10 text-primary border-primary/20",
    delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    cancelled: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };
  const cls = map[status] || "bg-card text-foreground border-border/40";
  return <span className={`inline-block rounded-sm border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{status}</span>;
}

export default function OrdersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { list } = useSelector((s: RootState) => s.orders);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, [dispatch]);

  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-4xl font-semibold tracking-wide text-foreground">Your Orders</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Track, view invoice, and manage your recent purchases.
          </p>
        </div>

        {(!list || list.length === 0) && (
          <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
            <p className="text-sm text-muted-foreground">No orders found. Add products to your cart and proceed to checkout.</p>
            <Link
              href="/products"
              className="inline-block mt-5 btn-primary px-6 py-2.5 text-xs"
            >
              Browse Products
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {list.map((o: any) => {
            const images = (o.items || [])
              .slice(0, 3)
              .map((it: any) => getImageUrl(it.product?.images?.[0]));
            const more = Math.max(0, (o.items || []).length - 3);
            const method = o.shippingMethod || "standard";
            const total = o.totalAmount ?? 0;

            return (
              <div
                key={o._id}
                className="bg-card/60 backdrop-blur-md border border-border/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 rounded-xl shadow-soft transition-all duration-200 hover:border-primary/20 hover:shadow-soft"
              >
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2 shrink-0">
                    {images.map((src: string, i: number) => (
                      <img
                        key={i}
                        src={src}
                        alt="Order item"
                        className="h-12 w-12 rounded-lg border border-border/40 bg-card object-cover"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                    ))}
                    {more > 0 && (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/40 bg-card/60 text-xs font-semibold text-foreground">
                        +{more}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-sm">
                        Order #{o._id.slice(-6).toUpperCase()}
                      </p>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {shortDate(o.createdAt)} · {method === "express" ? "Express delivery" : "Standard delivery"}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {o.items?.length || 0} item
                      {o.items?.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 border-t sm:border-0 border-border/20 pt-3 sm:pt-0">
                  <p className="display-font font-semibold text-xl text-foreground">
                    {currency(total)}
                  </p>
                  <Link
                    href={`/orders/${o._id}`}
                    className="btn px-4 py-2 text-xs"
                  >
                    View order
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ProtectedRoute>
  );
}
