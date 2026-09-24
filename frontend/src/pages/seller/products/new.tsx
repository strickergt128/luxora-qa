import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import ProtectedRoute from "../../../components/layout/ProtectedRoute";
import ProductForm from "../../../components/products/ProductForm";
import SellerLayout from "../../../components/layout/SellerLayout";
import PermissionGate from "../../../components/layout/PermissionGate";

function NewProductPage() {
  const router = useRouter();

  return (
    <ProtectedRoute roles={["seller", "admin"]}>
      <SellerLayout>
        <PermissionGate
          scope="seller"
          perm="seller:products:write"
          fallback={
            <div className="bg-card/60 backdrop-blur-md border border-border/40 p-12 text-center rounded-xl shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You do not have permission to add products.</p>
            </div>
          }
        >
          <div className="border-b border-border/40 pb-5 mb-8">
            <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">
              Add Product
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Create a new product listing with rich descriptions, specs, and gallery media.
            </p>
          </div>
          <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
            <ProductForm onSuccess={() => router.push("/seller/products")} />
          </div>
        </PermissionGate>
      </SellerLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(NewProductPage), { ssr: false });
