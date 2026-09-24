import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import SellerLayout from "../../../components/layout/SellerLayout";
import PermissionGate from "../../../components/layout/PermissionGate";
import api from "../../../utils/api";
import { currency } from "../../../utils/format";
import { getImageUrl } from "../../../utils/images";
import Link from "next/link";
import { useAuth } from "../../../hooks/useAuth";
import { hasSellerPerm } from "../../../utils/permissions";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-border/40 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground bg-secondary/15 inline-flex items-center">
      {children}
    </span>
  );
}

function SellerProductDetailsPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { user } = useAuth();

  const canRead = hasSellerPerm(user as any, "seller:products:read");
  const canWrite = hasSellerPerm(user as any, "seller:products:write");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOne = async () => {
    if (!id || !canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/seller/products/${id}`);
      setData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOne();
  }, [id, canRead]);

  const remove = async () => {
    if (!id) return;
    if (!canWrite) return alert("You don't have permission to delete products");
    if (!confirm("Are you sure you want to delete this product? This action is permanent.")) return;
    try {
      await api.delete(`/products/${id}`);
      router.replace("/seller/products");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to delete product");
    }
  };

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:products:read"
          fallback={
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You do not have permission to view store products.</p>
            </div>
          }
        >
          {loading || !data ? (
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <div className="h-6 w-6 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">Loading product details...</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5 mb-8">
                <div>
                  <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
                    Product Details
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    Review specifications, inventory levels, attributes, and sales performance.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <PermissionGate scope="seller" perm="seller:products:write">
                    <Link
                      href={`/seller/products/edit/${data.product._id}`}
                      className="btn-primary py-2.5 px-4 text-xs"
                    >
                      Edit Product
                    </Link>
                  </PermissionGate>
                  <PermissionGate scope="seller" perm="seller:products:write">
                    <button
                      onClick={remove}
                      className="btn py-2.5 px-4 text-xs text-rose-400 border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25"
                    >
                      Delete Product
                    </button>
                  </PermissionGate>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Left: Product Info Card */}
                <div className="md:col-span-2 bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft space-y-6">
                  <div className="flex flex-col sm:flex-row gap-6">
                    <img
                      src={getImageUrl(data.product.images?.[0])}
                      className="w-48 h-48 object-cover border border-border/40 rounded-lg shadow-sm bg-card"
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).src =
                          "/fallback.png")
                      }
                      alt={data.product.title}
                    />
                    <div className="space-y-3">
                      <div className="text-xl font-semibold text-foreground">
                        {data.product.title}
                      </div>
                      <div className="text-primary font-bold text-2xl">
                        {currency(data.product.price)}
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground space-y-1 pt-1.5">
                        <div className="text-foreground">
                          Category: <span className="text-muted-foreground normal-case font-normal ml-1">{data.product.category || "—"}</span>
                        </div>
                        <div className="text-foreground">
                          Stock Units: <span className="text-muted-foreground normal-case font-normal ml-1">{data.product.stock}</span>
                        </div>
                        {data.product.sku && (
                          <div className="text-foreground">
                            SKU Code: <span className="text-muted-foreground font-mono font-normal ml-1">{data.product.sku}</span>
                          </div>
                        )}
                        {data.product.brand && (
                          <div className="text-foreground">
                            Brand: <span className="text-muted-foreground normal-case font-normal ml-1">{data.product.brand}</span>
                          </div>
                        )}
                      </div>
                      {data.product.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {data.product.tags
                            .slice(0, 6)
                            .map((t: string, i: number) => (
                              <Chip key={`${t}-${i}`}>{t}</Chip>
                            ))}
                          {data.product.tags.length > 6 && (
                            <Chip>+{data.product.tags.length - 6}</Chip>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail gallery */}
                  {(data.product.images || []).slice(1).length > 0 && (
                    <div className="pt-6 border-t border-border/20">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Additional Galleries</h4>
                      <div className="flex flex-wrap gap-3">
                        {(data.product.images || [])
                          .slice(1, 4)
                          .map((img: any, i: number) => {
                            const src = getImageUrl(img);
                            return (
                              <div key={i} className="w-20 h-20 border border-border/40 rounded-lg overflow-hidden shrink-0 shadow-sm bg-card">
                                <img
                                  src={src}
                                  alt={`thumb-${i}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) =>
                                    ((e.currentTarget as HTMLImageElement).src =
                                      "/fallback.png")
                                  }
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Product description */}
                  {data.product.description && (
                    <div className="pt-6 border-t border-border/20">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Description</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {data.product.description}
                      </p>
                    </div>
                  )}

                  {/* Custom Attributes */}
                  {data.product.attributes?.length ? (
                    <div className="pt-6 border-t border-border/20">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Attributes & Metadata
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {data.product.attributes.map((a: any, i: number) => (
                          <div key={i} className="flex flex-col gap-0.5 p-3 border border-border/30 bg-secondary/10 rounded-lg">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{a.key}</span>
                            <span className="text-xs font-semibold text-foreground">{a.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* SEO Metadata */}
                  {(data.product.seo?.title ||
                    data.product.seo?.description) && (
                    <div className="pt-6 border-t border-border/20">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">SEO Preview Settings</h3>
                      <div className="space-y-3">
                        {data.product.seo?.title && (
                          <div className="p-3.5 border border-border/30 bg-secondary/10 rounded-lg">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">SEO Title</div>
                            <div className="text-xs font-semibold text-foreground">{data.product.seo.title}</div>
                          </div>
                        )}
                        {data.product.seo?.description && (
                          <div className="p-3.5 border border-border/30 bg-secondary/10 rounded-lg">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">SEO Description</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">{data.product.seo.description}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Sales Analytics Cards */}
                <div className="space-y-6">
                  <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 text-center rounded-xl shadow-soft">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Orders Count</div>
                    <div className="text-3xl font-bold text-foreground">
                      {data.analytics.ordersCount}
                    </div>
                  </div>
                  <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 text-center rounded-xl shadow-soft">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Units Sold</div>
                    <div className="text-3xl font-bold text-foreground">
                      {data.analytics.sold}
                    </div>
                  </div>
                  <div className="bg-card/60 backdrop-blur-md border border-primary/45 p-6 text-center rounded-xl shadow-soft">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Revenue</div>
                    <div className="text-3xl font-bold text-primary truncate" title={currency(data.analytics.revenue)}>
                      {currency(data.analytics.revenue)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(SellerProductDetailsPage), {
  ssr: false,
});
