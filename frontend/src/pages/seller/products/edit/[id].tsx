import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../../components/layout/ProtectedRoute";
import ProductForm from "../../../../components/products/ProductForm";
import api from "../../../../utils/api";
import SellerLayout from "../../../../components/layout/SellerLayout";
import PermissionGate from "../../../../components/layout/PermissionGate";
import { useAuth } from "../../../../hooks/useAuth";
import { hasSellerPerm } from "../../../../utils/permissions";

function EditProductPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { user } = useAuth();
  const canWrite = hasSellerPerm(user as any, "seller:products:write");

  const [initial, setInitial] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !canWrite) return;
    (async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        setInitial(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, canWrite]);

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:products:write"
          fallback={
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You do not have permission to edit products.</p>
            </div>
          }
        >
          <div className="border-b border-border/40 pb-5 mb-8">
            <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
              Edit Product
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Update product specs, price, inventory levels, and images.
            </p>
          </div>

          {loading ? (
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <div className="h-6 w-6 animate-spin border-2 border-primary/20 border-t-primary rounded-full mx-auto" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">Loading product settings...</p>
            </div>
          ) : !initial ? (
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Product listing not found or unavailable.</p>
            </div>
          ) : (
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
              <ProductForm
                initial={initial}
                onSuccess={() => router.push("/seller/products")}
              />
            </div>
          )}
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(EditProductPage), { ssr: false });
