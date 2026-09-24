import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import type { RootState, AppDispatch } from "../store";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import api from "../utils/api";
import { currency } from "../utils/format";
import { clearCart } from "../store/slices/cartSlice";
import { toast } from "react-hot-toast";
import { getImageUrl } from "../utils/images";
import { trackCheckout } from "../utils/analytics";

type Address = {
  _id?: string;
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  isDefault?: boolean;
};

function CheckoutPage() {
  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <CheckoutInner />
    </ProtectedRoute>
  );
}

function CheckoutInner() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const items = useSelector((s: RootState) => s.cart.items ?? []);
  const user = useSelector((s: RootState) => s.auth.user);
  const addresses = useMemo(
    () => ((user?.addresses as Address[] | undefined) || []),
    [user?.addresses]
  );

  const trackedRef = useRef(false);
  useEffect(() => {
    if (!trackedRef.current && items.length > 0) {
      trackCheckout();
      trackedRef.current = true;
    }
  }, [items.length]);

  const [mode, setMode] = useState<"existing" | "new">(
    addresses.length > 0 ? "existing" : "new"
  );

  const defaultAddrId =
    addresses.find((a) => a.isDefault)?._id || addresses[0]?._id;
  const [selectedAddressId, setSelectedAddressId] = useState<
    string | undefined
  >(defaultAddrId);

  useEffect(() => {
    if (!addresses.length) {
      setMode("new");
      setSelectedAddressId(undefined);
    } else if (!selectedAddressId) {
      setMode("existing");
      setSelectedAddressId(
        addresses.find((a) => a.isDefault)?._id || addresses[0]?._id
      );
    }
  }, [addresses, selectedAddressId]);

  const [newAddr, setNewAddr] = useState<Address>({
    label: "Home",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "India",
    phone: "",
    isDefault: true,
  });
  const [saveToProfile, setSaveToProfile] = useState(true);

  const [shipping, setShipping] = useState<"standard" | "express">("standard");

  const {
    discount: cartDiscount,
    discountedSubtotal: cartDiscountedSubtotal,
    appliedCoupon,
  } = useSelector((s: RootState) => s.cart);
  const rawSubtotal = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + (i.priceAtAdd ?? i.product.price) * i.qty,
        0
      ),
    [items]
  );
  const effectiveSubtotal = cartDiscountedSubtotal || rawSubtotal;
  const shippingCost = shipping === "express" ? 99 : 0;
  const tax = Math.round(effectiveSubtotal * 0.05);
  const grandTotal = effectiveSubtotal + shippingCost + tax;

  const [placing, setPlacing] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");

  const formatAddress = (a: Address) =>
    [a.label, a.line1, a.line2, a.city, a.state, a.zip, a.country, a.phone]
      .filter(Boolean)
      .join(", ");

  const addressToSend =
    mode === "existing"
      ? formatAddress(addresses.find((a) => a._id === selectedAddressId) || {})
      : formatAddress(newAddr);

  const canPlaceOrder =
    items.length > 0 &&
    ((mode === "existing" && !!selectedAddressId) ||
      (mode === "new" && !!newAddr.line1 && !!newAddr.city));

  const placeOrder = async () => {
    setAddressError("");
    if (!canPlaceOrder) {
      setAddressError("Select a saved address or add a complete shipping address.");
      toast.error("Select a saved address or add a complete shipping address.");
      return;
    }
    if (!acceptedPolicies) {
      setLiveMessage("Accept the terms and privacy policy to place your order.");
      toast.error("Accept the terms and privacy policy to place your order.");
      return;
    }

    setPlacing(true);
    const t = toast.loading("Sending your order...");

    try {
      if (mode === "new" && saveToProfile) {
        try {
          await api.post("/users/addresses", newAddr);
        } catch {}
      }

      await api.post("/orders", {
        address: addressToSend,
        shippingMethod: shipping,
      });

      dispatch(clearCart());
      setLiveMessage("Your order was placed.");

      toast.success("Order placed", { id: t });
      router.push("/orders");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "We could not place your order.";
      setLiveMessage("We could not place your order.");
      toast.error(message, {
        id: t,
      });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8">
      <div className="md:col-span-3 mb-2">
        <ol className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {["Address", "Delivery", "Review", "Pay"].map((step, idx) => (
            <li
              key={step}
              className={`px-3 py-2 rounded-md border text-center font-semibold transition-colors duration-200 ${
                idx <= 1
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 bg-secondary/20 text-muted-foreground"
              }`}
            >
              {idx + 1}. {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Left: Address + Shipping */}
      <div className="md:col-span-2 space-y-8">
        <section className="bg-card/60 backdrop-blur-md border border-border/40 shadow-soft p-6 rounded-xl space-y-6">
          <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground border-b border-border/30 pb-3">
            Shipping Address
          </h2>

          {/* Mode toggle */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => setMode("existing")}
              className={`btn text-xs flex-1 py-3 ${
                mode === "existing"
                  ? "btn-primary"
                  : "bg-card text-foreground"
              }`}
              disabled={addresses.length === 0}
              title={
                addresses.length === 0
                  ? "No saved addresses. Add one below."
                  : ""
              }
            >
              Use saved address
            </button>
            <button
              onClick={() => setMode("new")}
              className={`btn text-xs flex-1 py-3 ${
                mode === "new"
                  ? "btn-primary"
                  : "bg-card text-foreground"
              }`}
            >
              Add new address
            </button>
          </div>

          {/* Existing addresses */}
          {mode === "existing" && addresses.length > 0 && (
            <div className="space-y-4">
              {addresses.map((a) => (
                <label
                  key={a._id}
                  className={`flex flex-col sm:flex-row items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedAddressId === a._id
                      ? "bg-primary/5 border-primary shadow-sm"
                      : "bg-card/40 border-border/40 hover:border-primary/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="addr"
                    className="mt-1.5 w-4 h-4 border border-border text-primary focus:ring-primary focus:ring-offset-0 shrink-0"
                    checked={selectedAddressId === a._id}
                    onChange={() => setSelectedAddressId(a._id)}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground text-base">
                        {a.label || "Saved address"}
                      </p>
                      {a.isDefault && (
                        <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 font-semibold uppercase tracking-wider text-emerald-600 px-2 py-0.5 rounded-sm">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {[a.line1, a.line2, a.city, a.state, a.zip, a.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {a.phone && (
                      <p className="text-muted-foreground text-xs mt-1">📞 {a.phone}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* New address form */}
          {mode === "new" && (
            <div className="grid md:grid-cols-2 gap-4 mt-2">
              <input
                placeholder="Address label (e.g. Home)"
                className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 text-sm"
                value={newAddr.label || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, label: e.target.value })
                }
              />
              <input
                placeholder="Phone number"
                className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 text-sm"
                value={newAddr.phone || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, phone: e.target.value })
                }
              />
              <input
                placeholder="Street address"
                className="md:col-span-2 w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 text-sm"
                value={newAddr.line1 || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, line1: e.target.value })
                }
              />
              <input
                placeholder="Apartment, suite, or landmark"
                className="md:col-span-2 w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 text-sm"
                value={newAddr.line2 || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, line2: e.target.value })
                }
              />
              <input
                placeholder="City"
                className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 text-sm"
                value={newAddr.city || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, city: e.target.value })
                }
              />
              <input
                placeholder="State"
                className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 text-sm"
                value={newAddr.state || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, state: e.target.value })
                }
              />
              <input
                placeholder="Postal code"
                className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 text-sm"
                value={newAddr.zip || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, zip: e.target.value })
                }
              />
              <input
                placeholder="Country"
                className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45 text-sm"
                value={newAddr.country || ""}
                onChange={(e) =>
                  setNewAddr({ ...newAddr, country: e.target.value })
                }
              />
              <label className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:col-span-2 mt-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 border border-border text-primary rounded focus:ring-primary focus:ring-offset-0 shrink-0"
                  checked={saveToProfile}
                  onChange={(e) => setSaveToProfile(e.target.checked)}
                />
                Save address as{" "}
                <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 border border-primary/20 rounded-md">
                  {newAddr.label || "Home"}
                </span>
              </label>
            </div>
          )}
          {addressError && (
            <p className="text-xs text-rose-500 font-semibold">{addressError}</p>
          )}
        </section>

        {/* Shipping method */}
        <section className="bg-card/60 backdrop-blur-md border border-border/40 shadow-soft p-6 rounded-xl space-y-6">
          <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground border-b border-border/30 pb-3">
            Shipping Method
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => setShipping("standard")}
              className={`p-4 border rounded-lg text-left transition-all duration-200 ${
                shipping === "standard"
                  ? "bg-primary/5 border-primary shadow-sm"
                  : "bg-card/40 border-border/40 hover:border-primary/20"
              }`}
            >
              <p className="font-semibold text-foreground text-base mb-1">Standard delivery</p>
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Arrives in 4 to 7 days · Free</p>
            </button>
            <button
              onClick={() => setShipping("express")}
              className={`p-4 border rounded-lg text-left transition-all duration-200 ${
                shipping === "express"
                  ? "bg-primary/5 border-primary shadow-sm"
                  : "bg-card/40 border-border/40 hover:border-primary/20"
              }`}
            >
              <p className="font-semibold text-foreground text-base mb-1">Express delivery</p>
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Arrives in 1 to 2 days · ₹99</p>
            </button>
          </div>
        </section>
      </div>

      {/* Right: Order Summary */}
      <aside className="bg-card/65 backdrop-blur-md border border-border/40 shadow-soft p-6 h-fit md:sticky md:top-24 rounded-xl space-y-6">
        <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground border-b border-border/30 pb-3">Order Summary</h2>

        {items.length === 0 ? (
          <div className="text-muted-foreground text-sm">
            Your cart is empty.{" "}
            <Link href="/products" className="text-primary hover:underline">
              Shop products
            </Link>
          </div>
        ) : (
          <>
            <div className="max-h-60 overflow-auto pr-2 space-y-4">
              {items.map((i) => (
                <div key={i._id} className="flex items-center gap-4">
                  <div className="relative w-16 h-16 shrink-0 border border-border/40 rounded-lg overflow-hidden">
                    <Image
                      src={getImageUrl(i.product.images?.[0])}
                      alt={i.product.title}
                      fill
                      sizes="64px"
                      className="object-cover animate-fade-in"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{i.product.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">Qty: {i.qty}</p>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {currency((i.priceAtAdd ?? i.product.price) * i.qty)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-6 border-t border-border/30 text-xs font-semibold uppercase tracking-wider">
               <div className="flex justify-between text-muted-foreground">
                 <span>Subtotal</span>
                 <span className="text-foreground">{currency(rawSubtotal)}</span>
               </div>
               <div className="flex justify-between text-muted-foreground">
                 <span>Delivery</span>
                 <span className="text-foreground">
                   {shippingCost === 0 ? "Free" : currency(shippingCost)}
                 </span>
               </div>
               {appliedCoupon && cartDiscount > 0 && (
                 <div className="flex justify-between text-emerald-500">
                   <span>Discount ({appliedCoupon.code})</span>
                   <span>-{currency(cartDiscount)}</span>
                 </div>
               )}
               <div className="flex justify-between text-muted-foreground">
                 <span>Tax (5%)</span>
                 <span className="text-foreground">{currency(tax)}</span>
               </div>
             </div>
             
             <div className="flex justify-between display-font font-semibold uppercase tracking-wide text-2xl text-foreground pt-4 border-t border-border/30">
               <span>Total</span>
               <span>{currency(grandTotal)}</span>
             </div>

            {/* Explicit legal acceptance */}
            <div className="flex items-start gap-3 bg-secondary/40 p-4 border border-border/40 rounded-lg mt-6">
              <input
                id="accept-policies"
                type="checkbox"
                className="mt-0.5 w-4 h-4 border border-border text-primary rounded focus:ring-primary focus:ring-offset-0 shrink-0"
                checked={acceptedPolicies}
                onChange={(e) => setAcceptedPolicies(e.target.checked)}
              />
              <label
                htmlFor="accept-policies"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-relaxed"
              >
                I agree to the{" "}
                <Link
                  href="/policies/terms"
                  className="text-primary hover:text-primary-hover hover:underline transition-colors"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/policies/privacy"
                  className="text-primary hover:text-primary-hover hover:underline transition-colors"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <div className="pt-2">
              <div className="mb-4 grid grid-cols-1 gap-1.5 text-[10px] text-muted-foreground">
                <div className="rounded-md border border-border/40 px-3 py-2 bg-secondary/35 uppercase tracking-wider font-semibold">
                  ✓ Buyer protection included
                </div>
                <div className="rounded-md border border-border/40 px-3 py-2 bg-secondary/35 uppercase tracking-wider font-semibold">
                  ✓ Easy returns on eligible items
                </div>
                <div className="rounded-md border border-border/40 px-3 py-2 bg-secondary/35 uppercase tracking-wider font-semibold">
                  ✓ Secure checkout and protected payment data
                </div>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing || !canPlaceOrder || !acceptedPolicies}
                className="w-full btn-primary py-4 disabled:opacity-50 text-base"
              >
                {placing ? "Sending order..." : "Place order"}
              </button>
            </div>
            {!canPlaceOrder && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500 text-center mt-2">
                Select a saved address or add a complete shipping address.
              </p>
            )}
            <p aria-live="polite" className="sr-only">
              {liveMessage}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

export default dynamic(() => Promise.resolve(CheckoutPage), { ssr: false });
