import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import {
  updateCartQty,
  removeFromCart,
  fetchCart,
} from "../store/slices/cartSlice";
import { applyCoupon, removeCoupon } from "../store/slices/cartSlice";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currency } from "../utils/format";
import { getImageUrl } from "../utils/images";
import { TrashIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";

export default function CartPage() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items,
    subtotal,
    discount,
    discountedSubtotal,
    appliedCoupon,
    couponError,
  } = useSelector((s: RootState) => s.cart);

  const [code, setCode] = useState("");

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  if (!items || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="bg-card/60 backdrop-blur-md border border-border/40 shadow-soft p-12 max-w-xl mx-auto flex flex-col items-center rounded-xl">
          <img
            src="/empty-cart.svg"
            alt="Empty cart"
            className="w-40 mx-auto mb-8 opacity-80"
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
            }
          />
          <h2 className="display-font text-3xl font-semibold uppercase tracking-wide text-foreground mb-4">
            Your cart is empty
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Add products to review pricing, delivery, and checkout.
          </p>
          <Link
            href="/products"
            className="btn-primary px-8 py-3 block max-w-xs mx-auto text-center"
          >
            Shop products
          </Link>
        </div>
      </div>
    );
  }

  const tax = Math.round(discountedSubtotal * 0.05);
  const total = discountedSubtotal + tax;

  const onDecrease = async (id: string, qty: number) => {
    if (qty <= 1) return;
    await dispatch(updateCartQty({ itemId: id, qty: qty - 1 }));
    await dispatch(fetchCart());
  };

  const onIncrease = async (id: string, qty: number) => {
    await dispatch(updateCartQty({ itemId: id, qty: qty + 1 }));
    await dispatch(fetchCart());
  };

  const onRemove = async (id: string) => {
    await dispatch(removeFromCart(id));
    await dispatch(fetchCart());
  };

  const onApply = async () => {
    if (!code.trim()) return;
    const action = await dispatch(applyCoupon(code.trim().toUpperCase()));
    if (applyCoupon.fulfilled.match(action)) {
      toast.success("Discount applied");
      setCode("");
      dispatch(fetchCart());
    } else {
      toast.error((action.payload as any) || "Enter a valid code");
    }
  };

  const onRemoveCoupon = async () => {
    await dispatch(removeCoupon());
    toast.success("Discount removed");
    dispatch(fetchCart());
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8">
      {/* Cart Items */}
      <div className="md:col-span-2 space-y-4">
        {items.map((i) => (
          <div key={i._id} className="bg-card/60 backdrop-blur-md border border-border/40 rounded-xl p-5 group transition-all duration-200 hover:border-primary/20 hover:shadow-soft">
            <div className="grid grid-cols-[72px,1fr] sm:grid-cols-[112px,1fr,auto] gap-5 items-start sm:items-center">
              <img
                src={getImageUrl(i.product.images?.[0])}
                alt={i.product.title}
                className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-lg border border-border/45 shadow-sm"
                onError={(e) =>
                  ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
                }
              />

              <div className="min-w-0 pr-2">
                <h3 className="font-semibold text-foreground text-lg truncate group-hover:text-primary transition-colors">
                  {i.product.title}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {currency(i.priceAtAdd ?? i.product.price)} each
                </p>

                {/* Quantity controls */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() => onDecrease(i._id, i.qty)}
                    className="w-9 h-9 flex items-center justify-center rounded-md border border-border/60 bg-card hover:bg-secondary/40 transition-colors focus:outline-none"
                  >
                    <span className="text-foreground font-semibold">-</span>
                  </button>
                  <span className="w-10 text-center text-foreground font-semibold text-base">{i.qty}</span>
                  <button
                    aria-label="Increase quantity"
                    onClick={() => onIncrease(i._id, i.qty)}
                    className="w-9 h-9 flex items-center justify-center rounded-md border border-border/60 bg-card hover:bg-secondary/40 transition-colors focus:outline-none"
                  >
                    <span className="text-foreground font-semibold">+</span>
                  </button>
                </div>
              </div>

              {/* Price + Remove */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 mt-4 sm:mt-0 sm:self-start sm:text-right">
                <p className="display-font text-2xl font-semibold text-foreground">
                  {currency((i.priceAtAdd ?? i.product.price) * i.qty)}
                </p>
                <button
                  aria-label="Remove item"
                  onClick={() => onRemove(i._id)}
                  className="mt-2 text-rose-500 hover:text-rose-600 transition-colors inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <aside className="bg-card/65 backdrop-blur-md border border-border/40 shadow-soft p-6 h-fit md:sticky md:top-24 rounded-xl space-y-6">
        <h2 className="display-font text-2xl font-semibold uppercase tracking-wide text-foreground border-b border-border/30 pb-3">Order Summary</h2>

        {/* Coupon UI */}
        <div className="space-y-2">
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md">
              <span>Code: {appliedCoupon.code}</span>
              <button onClick={onRemoveCoupon} className="hover:underline">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter discount code"
                className="flex-1 bg-card/60 border border-border/80 rounded-md px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-all uppercase placeholder:text-muted-foreground/45 text-sm"
              />
              <button
                onClick={onApply}
                className="px-4 py-2 btn text-sm"
              >
                Apply
              </button>
            </div>
          )}
          {couponError && (
            <p className="text-xs font-semibold text-rose-500 mt-1">{couponError}</p>
          )}
        </div>

        <div className="space-y-3 pb-4 border-b border-border/30 text-xs font-semibold uppercase tracking-wider">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="text-foreground">{currency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-500">
              <span>Discount</span>
              <span>-{currency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Estimated tax (5%)</span>
            <span className="text-foreground">{currency(tax)}</span>
          </div>
        </div>
        
        <div className="flex justify-between display-font font-semibold uppercase tracking-wide text-2xl text-foreground">
          <span>Total</span>
          <span>{currency(total)}</span>
        </div>

        <Link
          href="/checkout"
          className="w-full text-center btn-primary py-3 block mt-4"
        >
          Continue to checkout
        </Link>
      </aside>
    </div>
  );
}
