import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { fetchOrder } from "../../store/slices/orderSlice";
import type { AppDispatch, RootState } from "../../store";
import { currency, shortDate } from "../../utils/format";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import { getImageUrl } from "../../utils/images";
import api from "../../utils/api";
import { toast } from "react-hot-toast";

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-sm text-[10px] uppercase tracking-wider font-semibold border ${color}`}>
      {text}
    </span>
  );
}

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

const STEPS = ["pending", "confirmed", "shipped", "delivered"] as const;
type Step = (typeof STEPS)[number];

function StepTimeline({ displayStatus }: { displayStatus: Step }) {
  const idx = STEPS.indexOf(displayStatus);
  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2.5 mb-5">Order Status</h3>

      {/* Mobile: vertical timeline */}
      <ol className="md:hidden relative border-l border-border/60 pl-4 space-y-4">
        {STEPS.map((s, i) => {
          const active = i <= idx;
          return (
            <li key={`m-${s}`} className="relative pl-4">
              <span
                className={`absolute -left-2.5 top-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-semibold ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/60"
                }`}
              >
                {i + 1}
              </span>
              <div
                className={`uppercase tracking-wider text-xs font-bold ${
                  active ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {s}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Desktop: horizontal timeline */}
      <div className="hidden md:block">
        <ol className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const active = i <= idx;
            return (
              <li key={`d-${s}`} className="flex-1 flex items-center">
                <div className="flex flex-col items-center text-center w-24">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border/60"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div
                    className={`mt-2.5 text-[10px] font-semibold uppercase tracking-wider ${
                      active ? "text-foreground font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {s}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-4 rounded-full ${
                      i < idx ? "bg-primary" : "bg-border/40"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function openInvoiceTab(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const win = window.open(url, "_blank");
  if (!win) {
    window.location.href = url;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type RRStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "refunded"
  | "cancelled";
type ReturnItem = {
  product: { _id: string; title?: string } | string;
  qty: number;
  price: number;
};
type ReturnRequest = {
  _id: string;
  order: string;
  user: string;
  items: ReturnItem[];
  reason?: string;
  note?: string;
  attachments?: { url: string; name?: string }[];
  status: RRStatus;
  refund?: {
    method?: "manual" | "bank" | "upi";
    reference?: string;
    amount?: number;
  };
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  receivedAt?: string;
  refundedAt?: string;
  cancelledAt?: string;
};

export default function OrderDetailsPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { id } = router.query as { id: string };
  const { current: o } = useSelector((s: RootState) => s.orders);

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [userNote, setUserNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;
    dispatch(fetchOrder(id));
    const interval = setInterval(() => {
      if (document.hidden) return;
      dispatch(fetchOrder(id));
    }, 5000);
    return () => clearInterval(interval);
  }, [id, dispatch]);

  const fetchReturns = async () => {
    if (!id) return;
    setLoadingReturns(true);
    try {
      const { data } = await api.get(`/orders/${id}/returns`);
      setReturns(Array.isArray(data) ? data : []);
    } catch {
      setReturns([]);
    } finally {
      setLoadingReturns(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchReturns();
  }, [id]);

  const activeReturnStatuses: RRStatus[] = [
    "requested",
    "approved",
    "received",
    "refunded",
  ];
  const availableByProduct = useMemo(() => {
    if (!o) return {} as Record<string, number>;
    const purchased = new Map<string, number>();
    for (const it of o.items || []) {
      const pid = typeof it.product === "string" ? it.product : it.product?._id;
      if (!pid) continue;
      purchased.set(pid, (purchased.get(pid) || 0) + Number(it.qty));
    }
    const used = new Map<string, number>();
    for (const rr of returns || []) {
      if (!activeReturnStatuses.includes(rr.status)) continue;
      for (const it of rr.items || []) {
        const pid =
          typeof it.product === "string" ? it.product : it.product?._id;
        if (!pid) continue;
        used.set(pid, (used.get(pid) || 0) + Number(it.qty));
      }
    }
    const available: Record<string, number> = {};
    Array.from(purchased.entries()).forEach(([pid, qty]) => {
      const u = used.get(pid) || 0;
      available[pid] = Math.max(0, qty - u);
    });
    return available;
  }, [o, returns]);

  const openReturn = () => {
    if (!o) return;
    const init: Record<string, number> = {};
    for (const it of o.items || []) {
      const pid = typeof it.product === "string" ? it.product : it.product?._id;
      if (!pid) continue;
      init[pid] = 0;
    }
    setQtyByProduct(init);
    setReason("");
    setUserNote("");
    setFile(null);
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!o) return;
    try {
      const items: { product: string; qty: number }[] = [];
      for (const it of o.items || []) {
        const pid =
          typeof it.product === "string" ? it.product : it.product?._id;
        if (!pid) continue;
        const maxAvail = availableByProduct[pid] || 0;
        const q = Math.max(
          0,
          Math.min(Number(qtyByProduct[pid] || 0), maxAvail)
        );
        if (q > 0) items.push({ product: pid, qty: q });
      }
      if (items.length === 0) {
        toast.error("Select at least one item to return");
        return;
      }

      const fd = new FormData();
      fd.append("items", JSON.stringify(items));
      if (reason) fd.append("reason", reason);
      if (userNote) fd.append("note", userNote);
      if (file) fd.append("file", file);

      await api.post(`/orders/${o._id}/returns`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Return request submitted");
      setReturnOpen(false);
      fetchReturns();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Failed to submit return request"
      );
    }
  };

  const [demoIdx, setDemoIdx] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startDemo = () => {
    if (!o) return;
    const currentIdx = Math.max(
      0,
      STEPS.indexOf((o.status || "pending") as Step)
    );
    setDemoIdx(currentIdx);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDemoIdx((prev) => {
        if (prev == null) return currentIdx;
        if (prev >= STEPS.length - 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return STEPS.length - 1;
        }
        return prev + 1;
      });
    }, 4000);
  };
  const stopDemo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDemoIdx(null);
  };

  if (!o) {
    return (
      <ProtectedRoute roles={["user", "seller", "admin"]}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl text-center text-muted-foreground">
            Loading...
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const subtotal =
    typeof o.subtotal === "number"
      ? o.subtotal
      : (o.items || []).reduce(
          (s: number, it: any) => s + Number(it.price) * Number(it.qty),
          0
        );
  const tax = typeof o.tax === "number" ? o.tax : 0;
  const shippingCost = typeof o.shippingCost === "number" ? o.shippingCost : 0;
  const shippingMethod = (o.shippingMethod || "standard") as
    | "standard"
    | "express";
  const totalAmount =
    typeof o.totalAmount === "number"
      ? o.totalAmount
      : subtotal + tax + shippingCost;

  const backendIdx = Math.max(
    0,
    STEPS.indexOf((o.status || "pending") as Step)
  );
  const displayIdx = Math.max(backendIdx, demoIdx ?? -1);
  const displayStatus = STEPS[displayIdx] as Step;

  const printInvoice = () => {
    const itemsRows = o.items
      .map(
        (it: any, idx: number) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${idx + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;word-break:break-word;">
          ${it.product?.title || "Product"}
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${it.qty}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">₹${it.price.toLocaleString(
          "en-IN"
        )}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">₹${(
          it.price * it.qty
        ).toLocaleString("en-IN")}</td>
      </tr>`
      )
      .join("");

    const subtotal =
      typeof o.subtotal === "number"
        ? o.subtotal
        : (o.items || []).reduce(
            (s: number, it: any) => s + Number(it.price) * Number(it.qty),
            0
          );
    const tax = typeof o.tax === "number" ? o.tax : 0;
    const shippingCost =
      typeof o.shippingCost === "number" ? o.shippingCost : 0;
    const shippingMethod = (o.shippingMethod || "standard") as
      | "standard"
      | "express";
    const totalAmount =
      typeof o.totalAmount === "number"
        ? o.totalAmount
        : subtotal + tax + shippingCost;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice #${o._id.slice(-6).toUpperCase()}</title>
  <style>
    :root { --brand:#d4af37; --text:#111827; --muted:#6b7280; --border:#e5e7eb; }
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Arial, sans-serif; color: var(--text); background: #fff; }
    .container { max-width: 780px; margin: 0 auto; padding: 24px; }
    .header { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; padding-bottom: 8px; }
    .brand { font-weight:800; font-size:22px; color: var(--brand); }
    .meta { text-align:right; font-size:12px; color: var(--muted); }
    .section { margin-top: 16px; }
    h3 { margin: 0 0 6px; font-size:16px; }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; }
    th { padding:8px; border-bottom:1px solid #ccc; font-weight:600; font-size:13px; }
    td { font-size:13px; padding:8px; border-bottom:1px solid #eee; }
    .totals td { padding:6px 8px; }
    .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:12px; border:1px solid var(--border); }
    .address { white-space:pre-wrap; font-size:14px; color:#374151; }
    .footnote { font-size:12px; color:#6b7280; margin-top: 12px; }
    .right { text-align:right; }
    .row { display:flex; justify-content:flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Luxora</div>
      <div class="meta">
        <div><strong>Invoice</strong> #${o._id.slice(-6).toUpperCase()}</div>
        <div>Date: ${shortDate(o.createdAt)}</div>
        <div>Status: <span class="badge">${o.status}</span></div>
      </div>
    </div>

    <div class="section">
      <h3>Bill To</h3>
      <div class="address">${o.address || ""}</div>
    </div>

    <div class="section">
      <h3>Items</h3>
      <table>
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Product</th>
            <th style="width:60px;">Qty</th>
            <th style="width:100px;">Price</th>
            <th style="width:120px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>

    <div class="section row">
      <table class="totals" style="width:360px;">
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td class="right">₹${subtotal.toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td>Tax</td>
            <td class="right">₹${tax.toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td>Shipping (${shippingMethod})</td>
            <td class="right">${
              shippingCost > 0
                ? "₹" + shippingCost.toLocaleString("en-IN")
                : "Free"
            }</td>
          </tr>
          <tr>
            <td style="border-top:1px solid #ccc; font-weight:700;">Total</td>
            <td style="border-top:1px solid #ccc;" class="right"><strong>₹${totalAmount.toLocaleString(
              "en-IN"
            )}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section footnote">
      <div>Payment Method: ${o.paymentMethod || "COD"}</div>
      <div>Thank you for shopping with Luxora.</div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){ window.focus(); window.print(); }, 150);
    });
  </script>
</body>
</html>`;
    openInvoiceTab(html);
  };

  return (
    <ProtectedRoute roles={["user", "seller", "admin"]}>
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
          <div className="min-w-0">
            <h1 className="display-font text-3xl font-semibold text-foreground truncate">
              Order #{o._id.slice(-6).toUpperCase()}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1 font-semibold uppercase tracking-wider">
              {shortDate(o.createdAt)} · <StatusBadge status={o.status} />
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2.5 w-full sm:w-auto shrink-0">
            <button
              onClick={printInvoice}
              className="btn py-2.5 text-xs font-semibold uppercase tracking-wider"
              title="Print / Save as PDF"
            >
              Print Invoice
            </button>
            {STEPS.indexOf((o.status || "pending") as Step) <
            STEPS.length - 1 ? (
              <button onClick={startDemo} className="btn py-2.5 text-xs font-semibold uppercase tracking-wider">
                Demo Status
              </button>
            ) : (
              <button onClick={stopDemo} className="btn py-2.5 text-xs font-semibold uppercase tracking-wider">
                Stop Demo
              </button>
            )}
            {o.status === "delivered" && (
              <button onClick={openReturn} className="btn-primary py-2.5 px-4 text-xs">
                Request Return
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <StepTimeline
          displayStatus={
            STEPS[
              Math.max(
                STEPS.indexOf((o.status || "pending") as Step),
                demoIdx ?? -1
              )
            ] as Step
          }
        />

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Items */}
          <div className="lg:col-span-8 bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">Items Ordered</h2>
            <div className="divide-y divide-border/20">
              {o.items.map((it: any, idx: number) => {
                const p = it.product || {};
                const img = getImageUrl(p.images?.[0]);
                return (
                  <div key={idx} className="py-4 first:pt-0 last:pb-0">
                    <div className="grid grid-cols-[64px,1fr] sm:grid-cols-[64px,1fr,auto] gap-4 items-center">
                      <img
                        src={img}
                        alt={p.title || "Product"}
                        className="w-16 h-16 rounded-lg border border-border/40 object-cover bg-card"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate">
                          {p.title || "Product"}
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1 space-x-2">
                          <span>Qty: {it.qty}</span>
                          {p.brand && <span>· Brand: {p.brand}</span>}
                          {p.sku && <span>· SKU: {p.sku}</span>}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-foreground sm:text-right shrink-0">
                        {currency(it.price * it.qty)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary + Address */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card/65 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">
                Price Summary
              </h3>
              <div className="space-y-3 text-xs font-semibold uppercase tracking-wider">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="normal-case text-foreground font-bold">{currency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="normal-case text-foreground font-bold">{currency(tax)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping ({shippingMethod})</span>
                  <span className="normal-case text-foreground font-bold">
                    {shippingCost > 0 ? currency(shippingCost) : "Free"}
                  </span>
                </div>
                <hr className="border-border/30" />
                <div className="flex justify-between text-foreground">
                  <span className="text-xs font-bold">Total</span>
                  <span className="normal-case text-lg font-bold text-primary">{currency(totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="bg-card/65 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-4">
                Delivery Details
              </h3>
              <div className="text-sm text-foreground whitespace-pre-line break-words leading-relaxed">
                {o.address}
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-4 pt-3 border-t border-border/20">
                Payment:{" "}
                <span className="text-foreground normal-case font-bold">{o.paymentMethod || "COD"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Returns history */}
        <div className="bg-card/60 backdrop-blur-md border border-border/40 p-6 rounded-xl shadow-soft">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/30 pb-2 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Returns & Refunds</h3>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {loadingReturns ? "Loading..." : `${returns.length} request(s)`}
            </div>
          </div>
          {returns.length === 0 ? (
            <div className="text-muted-foreground italic text-sm">
              No return requests for this order.
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {returns.map((rr) => {
                const attachment = rr.attachments?.[0];
                const total = rr.items.reduce(
                  (s, it) => s + it.qty * it.price,
                  0
                );
                return (
                  <div key={rr._id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          #{rr._id.slice(-6).toUpperCase()}
                        </span>
                        <Pill
                          text={rr.status}
                          color={
                            rr.status === "requested"
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              : rr.status === "approved"
                              ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                              : rr.status === "rejected"
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                              : rr.status === "received"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : rr.status === "refunded"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-card text-muted-foreground border-border/40"
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {shortDate(rr.requestedAt)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-foreground shrink-0">
                        Total: {currency(total)}
                      </div>
                    </div>

                    <div className="mt-3.5 grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-xs font-semibold uppercase tracking-wider">
                        {rr.items.map((it, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between"
                          >
                            <span className="text-muted-foreground">
                              {(typeof it.product === "string"
                                ? it.product
                                : it.product?.title) || "Item"}{" "}
                              × {it.qty}
                            </span>
                            <span className="text-foreground normal-case font-bold">
                              ₹{(it.qty * it.price).toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs space-y-1">
                        {rr.reason && (
                          <div>
                            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Reason: </span>
                            <span className="text-foreground">{rr.reason}</span>
                          </div>
                        )}
                        {rr.note && (
                          <div className="mt-1">
                            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Note: </span>
                            <span className="text-foreground">{rr.note}</span>
                          </div>
                        )}
                        {attachment && (
                          <div className="mt-1">
                            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Attachment: </span>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-bold"
                            >
                              {attachment.name || "View Attachment"}
                            </a>
                          </div>
                        )}
                        {rr.status === "refunded" && rr.refund && (
                          <div className="text-xs mt-2 pt-2 border-t border-border/20">
                            <div>
                              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Refund: </span>
                              <span className="text-primary font-bold">
                                {rr.refund.amount != null
                                  ? `₹${rr.refund.amount.toLocaleString(
                                      "en-IN"
                                    )}`
                                  : "—"}
                              </span>
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                              {rr.refund.method || "manual"}
                              {rr.refund.reference
                                ? ` · Ref: ${rr.refund.reference}`
                                : ""}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Return modal */}
        {returnOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-xl bg-card border border-border/40 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
                <h3 className="display-font text-lg font-semibold text-foreground">
                  Request Return / Refund
                </h3>
                <button
                  onClick={() => setReturnOpen(false)}
                  className="btn py-1 px-3 text-xs"
                >
                  Close
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Select items to return
                  </div>
                  <div className="space-y-3">
                    {o.items.map((it: any, idx: number) => {
                      const pid =
                        typeof it.product === "string"
                          ? it.product
                          : it.product?._id;
                      const title =
                        typeof it.product === "string"
                          ? it.product
                          : it.product?.title || "Item";
                      const maxAvail = availableByProduct[pid] || 0;
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr,100px] gap-4 items-center bg-secondary/25 p-3 rounded-lg border border-border/20"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{title}</div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                              Purchased: {it.qty} · Available to Return: {maxAvail}
                            </div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={maxAvail}
                            value={qtyByProduct[pid] ?? 0}
                            onChange={(e) => {
                              const val = Math.max(
                                0,
                                Math.min(Number(e.target.value || 0), maxAvail)
                              );
                              setQtyByProduct((q) => ({ ...q, [pid]: val }));
                            }}
                            className="w-full bg-card/60 border border-border/80 rounded-md px-3 py-2 text-center text-xs font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason for Return</label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe the issue (size, defect, wrong item, etc.)..."
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/45"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Additional details (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Any extra information that helps process your return..."
                    className="w-full bg-card/60 border border-border/80 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/45"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Proof attachment (optional)
                  </label>
                  <input
                    type="file"
                    id="media-upload"
                    accept="image/*,video/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="media-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border/85 bg-card/50 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-card hover:border-primary/40 cursor-pointer transition-all duration-200"
                  >
                    <svg
                      className="w-4 h-4 text-primary"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                      <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                    </svg>
                    {file ? file.name : "Choose File"}
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Add a photo or video to support your request (optional).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/30 bg-secondary/10">
                <button
                  onClick={() => setReturnOpen(false)}
                  className="btn py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReturn}
                  className="btn-primary py-2 px-5 text-xs"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
