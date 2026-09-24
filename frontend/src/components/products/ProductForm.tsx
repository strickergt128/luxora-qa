import { useEffect, useMemo, useState } from "react";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { getImageUrl } from "../../utils/images";
import { currency } from "../../utils/format";

type ExistingImage = { url: string; alt?: string };
type Category = { _id: string; name: string; slug: string; active: boolean };

type ProductInput = {
  title: string;
  description?: string;
  price: number;
  stock: number;
  tags?: string;
  sku?: string;
  brand?: string;
  discountPrice?: number;
  seoTitle?: string;
  seoDescription?: string;
  shipWeight?: number;
  shipLength?: number;
  shipWidth?: number;
  shipHeight?: number;
};

type Attr = { key: string; value: string };

type Props = {
  initial?: any;
  onSuccess?: (p: any) => void;
};

export default function ProductForm({ initial, onSuccess }: Props) {
  const [form, setForm] = useState<ProductInput>({
    title: initial?.title || "",
    description: initial?.description || "",
    price: initial?.price ?? 0,
    stock: initial?.stock ?? 0,
    tags: Array.isArray(initial?.tags)
      ? initial.tags.join(", ")
      : initial?.tags || "",
    sku: initial?.sku || "",
    brand: initial?.brand || "",
    discountPrice: initial?.discountPrice ?? undefined,
    seoTitle: initial?.seo?.title || "",
    seoDescription: initial?.seo?.description || "",
    shipWeight: initial?.shipping?.weight ?? undefined,
    shipLength: initial?.shipping?.length ?? undefined,
    shipWidth: initial?.shipping?.width ?? undefined,
    shipHeight: initial?.shipping?.height ?? undefined,
  });

  const [attrs, setAttrs] = useState<Attr[]>(
    Array.isArray(initial?.attributes) && initial.attributes.length
      ? initial.attributes
      : [{ key: "", value: "" }]
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newFileURLs, setNewFileURLs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [videoUrl, setVideoUrl] = useState<string>(initial?.videoUrl || "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const existingImages = useMemo(() => {
    return (initial?.images || []).map((img: any) =>
      typeof img === "string" ? { url: img } : img
    ) as ExistingImage[];
  }, [initial]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        setCategories(data || []);
        if (initial?.category) {
          const match = (data || []).find(
            (c: Category) => c.name === initial.category
          );
          if (match) setCategoryId(match._id);
        } else if (data?.[0]?._id) {
          setCategoryId(data[0]._id);
        }
      } catch {}
    })();
  }, [initial?.category]);

  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setNewFileURLs(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newFiles]);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreview(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const onChange =
    (key: keyof ProductInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = [
        "price",
        "stock",
        "discountPrice",
        "shipWeight",
        "shipLength",
        "shipWidth",
        "shipHeight",
      ].includes(key as string)
        ? e.target.value === ""
          ? undefined
          : Number(e.target.value)
        : e.target.value;
      setForm((f) => ({ ...f, [key]: v as any }));
    };

  const addAttr = () => setAttrs((arr) => [...arr, { key: "", value: "" }]);
  const setAttr = (i: number, part: "key" | "value", val: string) => {
    setAttrs((arr) =>
      arr.map((a, idx) => (idx === i ? { ...a, [part]: val } : a))
    );
  };
  const removeAttr = (i: number) =>
    setAttrs((arr) => arr.filter((_, idx) => idx !== i));

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setNewFiles((prev) => [...prev, ...files].slice(0, 5));
  };
  const removeNewFile = (idx: number) =>
    setNewFiles((arr) => arr.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || form.price == null || form.stock == null) {
      toast.error("Please fill title, price, and stock.");
      return;
    }
    if (!categoryId) {
      toast.error("Please select a category.");
      return;
    }

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description || "");
    fd.append("price", String(form.price ?? 0));
    fd.append("stock", String(form.stock ?? 0));
    fd.append("categoryId", categoryId);
    if (form.tags) fd.append("tags", form.tags);

    if (videoUrl) fd.append("videoUrl", videoUrl);
    if (videoFile) fd.append("video", videoFile);

    if (form.sku) fd.append("sku", form.sku);
    if (form.brand) fd.append("brand", form.brand);
    if (form.discountPrice != null)
      fd.append("discountPrice", String(form.discountPrice));

    const cleanAttrs = attrs
      .filter((a) => a.key && a.value)
      .map(({ key, value }) => ({ key, value }));
    if (cleanAttrs.length) fd.append("attributes", JSON.stringify(cleanAttrs));

    const seo: any = {};
    if (form.seoTitle) seo.title = form.seoTitle;
    if (form.seoDescription) seo.description = form.seoDescription;
    if (Object.keys(seo).length) fd.append("seo", JSON.stringify(seo));

    const shipping: any = {};
    if (form.shipWeight != null) shipping.weight = form.shipWeight;
    if (form.shipLength != null) shipping.length = form.shipLength;
    if (form.shipWidth != null) shipping.width = form.shipWidth;
    if (form.shipHeight != null) shipping.height = form.shipHeight;
    if (Object.keys(shipping).length)
      fd.append("shipping", JSON.stringify(shipping));

    newFiles.forEach((f) => fd.append("images", f));

    setSubmitting(true);
    try {
      let res;
      if (initial?._id) {
        res = await api.put(`/products/${initial._id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post(`/products`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success(`Product ${initial?._id ? "updated" : "created"} successfully!`);
      onSuccess?.(res.data);
      if (!initial?._id) {
        setForm({
          title: "",
          description: "",
          price: 0,
          stock: 0,
          tags: "",
          sku: "",
          brand: "",
          discountPrice: undefined,
          seoTitle: "",
          seoDescription: "",
          shipWeight: undefined,
          shipLength: undefined,
          shipWidth: undefined,
          shipHeight: undefined,
        });
        setAttrs([{ key: "", value: "" }]);
        setNewFiles([]);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  const previewImage =
    newFileURLs[0] ||
    (existingImages[0]?.url ? getImageUrl(existingImages[0]) : "/fallback.png");

  const effectivePrice =
    form.discountPrice != null ? form.discountPrice : form.price;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 bg-card/30 backdrop-blur-md border border-border/30 p-6 rounded-xl space-y-8"
      >
        {/* Basic */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 border-b border-border/30 pb-2">
            Basic Information
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Product Title</label>
              <input
                className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.title}
                onChange={onChange("title")}
                required
                placeholder="Product Title"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Category
              </label>
              <select
                className="w-full bg-card/60 border border-border/80 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-all duration-200"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select Category
                </option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Price (INR)</label>
              <input
                type="number"
                min={0}
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.price ?? 0}
                onChange={onChange("price")}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Stock Quantity</label>
              <input
                type="number"
                min={0}
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.stock ?? 0}
                onChange={onChange("stock")}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Advanced */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 border-b border-border/30 pb-2">Advanced Attributes</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">SKU Code</label>
              <input
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.sku || ""}
                onChange={onChange("sku")}
                placeholder="SLK-001"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Brand</label>
              <input
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.brand || ""}
                onChange={onChange("brand")}
                placeholder="Luxora"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Discount Price
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.discountPrice ?? ""}
                onChange={onChange("discountPrice")}
                placeholder="Promo Price"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Tags (comma separated)
            </label>
            <input
              className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
              value={form.tags || ""}
              onChange={onChange("tags")}
              placeholder="premium, spring, silk"
            />
          </div>

          <div className="mt-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Description
            </label>
            <textarea
              rows={4}
              className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
              value={form.description || ""}
              onChange={onChange("description")}
              placeholder="Premium Mulberry Silk scarf with hand-rolled hems..."
            />
          </div>
        </div>

        {/* Attributes */}
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground m-0">Dynamic Attributes</h3>
            <button
              type="button"
              onClick={addAttr}
              className="btn py-1.5 px-3.5 text-[10px]"
            >
              Add Key/Value
            </button>
          </div>
          <div className="space-y-3">
            {attrs.map((a, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="w-full sm:flex-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Attribute Name (e.g. Material)</label>
                  <input
                    placeholder="e.g. Material"
                    value={a.key}
                    onChange={(e) => setAttr(i, "key", e.target.value)}
                    className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                  />
                </div>
                <div className="w-full sm:flex-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Attribute Value (e.g. 100% Silk)</label>
                  <input
                    placeholder="e.g. 100% Silk"
                    value={a.value}
                    onChange={(e) => setAttr(i, "value", e.target.value)}
                    className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                  />
                </div>
                <div className="w-full sm:w-auto h-[46px] pt-1">
                  <button
                    type="button"
                    aria-label="Remove attribute"
                    onClick={() => removeAttr(i)}
                    className="btn w-full sm:w-10 h-10 flex items-center justify-center text-rose-400 border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25 rounded-md"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SEO */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 border-b border-border/30 pb-2">SEO Settings</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                SEO Meta Title
              </label>
              <input
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.seoTitle || ""}
                onChange={onChange("seoTitle")}
                placeholder="Meta title"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                SEO Meta Description
              </label>
              <input
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.seoDescription || ""}
                onChange={onChange("seoDescription")}
                placeholder="Meta description"
              />
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 border-b border-border/30 pb-2">Shipping Information</h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Weight (kg)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.shipWeight ?? ""}
                onChange={onChange("shipWeight")}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Length (cm)
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.shipLength ?? ""}
                onChange={onChange("shipLength")}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Width (cm)
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.shipWidth ?? ""}
                onChange={onChange("shipWidth")}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Height (cm)
              </label>
              <input
                type="number"
                min={0}
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
                value={form.shipHeight ?? ""}
                onChange={onChange("shipHeight")}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 border-b border-border/30 pb-2">Product Images</h3>
          <div className="flex gap-4">
            <input
              type="file"
              id="media-upload"
              multiple
              accept="image/*"
              onChange={onFiles}
              className="sr-only"
            />
            <label
              htmlFor="media-upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border/85 bg-card/50 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-card hover:border-primary/40 cursor-pointer transition-all duration-200"
            >
              <svg
                className="w-4 h-4 text-primary"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
              </svg>
              Upload Images
            </label>
          </div>

          {newFileURLs.length > 0 && (
            <div className="mt-5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">New Uploads (Max 5)</label>
              <div className="flex gap-4 flex-wrap">
                {newFileURLs.map((url, i) => (
                  <div key={i} className="relative w-24 h-24 border border-border/40 rounded-lg overflow-hidden group shadow-sm bg-card">
                    <img
                      src={url}
                      alt={`new-${i}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => removeNewFile(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-md bg-rose-500/90 text-white text-xs flex items-center justify-center hover:bg-rose-600 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {existingImages.length > 0 && (
            <div className="mt-6 border-t border-border/20 pt-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Existing Catalog Images
              </label>
              <div className="flex gap-4 flex-wrap">
                {existingImages.map((img, i) => (
                  <div key={i} className="w-24 h-24 border border-border/40 rounded-lg overflow-hidden shadow-sm bg-card">
                    <img
                      src={getImageUrl(img)}
                      alt={img.alt || "Catalog"}
                      className="w-full h-full object-cover"
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).src =
                          "/fallback.png")
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                * Note: Uploading new photos will append to existing catalog.
              </p>
            </div>
          )}
        </div>

        {/* Video */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 border-b border-border/30 pb-2">
            Video Showcase
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Video URL (Cloudinary / Direct MP4)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full bg-card/60 border border-border/88 rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder:text-muted-foreground/45"
              />
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                Provide a hosted direct video link. Uploading a video file takes priority.
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Upload Video File
              </label>
              <input
                type="file"
                id="video-upload"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
              <label
                htmlFor="video-upload"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border/85 bg-card/50 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-card hover:border-primary/40 cursor-pointer transition-all duration-200"
              >
                <svg
                  className="w-4 h-4 text-primary"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                  <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                </svg>
                {videoFile ? videoFile.name : "Select video file"}
              </label>
              {videoPreview ? (
                <div className="mt-4 border border-border/40 rounded-xl overflow-hidden shadow-soft bg-card w-full max-w-xs">
                  <video
                    src={videoPreview}
                    className="w-full aspect-video"
                    controls
                    playsInline
                  />
                </div>
              ) : initial?.videoUrl ? (
                <div className="mt-4 border border-border/40 rounded-xl overflow-hidden shadow-soft bg-card w-full max-w-xs">
                  <video
                    src={initial.videoUrl}
                    className="w-full aspect-video"
                    controls
                    playsInline
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary py-3 px-8 text-xs font-semibold uppercase tracking-wider w-full sm:w-auto mt-8"
        >
          {submitting
            ? initial?._id
              ? "Saving changes..."
              : "Creating item..."
            : initial?._id
            ? "Update Product Listing"
            : "Publish Product Listing"}
        </button>
      </form>

      {/* Live Preview */}
      <aside className="w-full lg:w-80 h-fit bg-card/60 backdrop-blur-md border border-border/40 rounded-xl overflow-hidden shadow-soft flex flex-col shrink-0">
        <div className="bg-primary/10 border-b border-border/30 p-3 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-primary text-center">Interactive Live Preview</div>
        </div>
        <div className="flex-grow">
          <div className="border-b border-border/30 aspect-square bg-secondary/10 overflow-hidden">
            <img
              src={previewImage}
              alt="preview"
              className="w-full h-full object-cover"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).src = "/fallback.png")
              }
            />
          </div>
          <div className="p-4 flex flex-col bg-transparent">
            <h3 className="font-semibold text-foreground text-sm line-clamp-2 leading-tight mb-1">
              {form.title || "Untitled Product"}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-bold text-primary">
                {currency(Number(effectivePrice) || 0)}
              </span>
              {form.discountPrice != null && (
                <span className="text-xs text-muted-foreground line-through">
                  {currency(Number(form.price) || 0)}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-3 leading-relaxed">
              {form.description || "Describe your product above and view structural updates instantly."}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
