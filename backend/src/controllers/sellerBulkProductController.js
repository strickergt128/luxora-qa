import { parse as parseCsv } from "csv-parse/sync";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import { v2 as cloudinary } from "cloudinary";

import Product from "../models/Product.js";
import Category from "../models/Category.js";

const STORAGE_MODE = String(process.env.STORAGE_MODE || "local").toLowerCase();

const IMG_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VID_EXT = new Set(["mp4", "webm", "mov", "mkv"]);

const ensureUploadsDir = async () => {
  const dir = path.join(process.cwd(), "uploads");
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch {}
  return dir;
};

const sanitizeFilename = (name = "") =>
  String(name)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();

const extOf = (filename = "") =>
  path.extname(filename).replace(".", "").toLowerCase();

const isHttpUrl = (s = "") => /^https?:\/\//i.test(String(s || ""));

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function toInt(v) {
  const n = toNumber(v);
  return n !== null ? Math.trunc(n) : null;
}

const splitComma = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const splitPipe = (v) =>
  String(v || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

const parseAttributes = (v) => {
  if (!v) return undefined; // omit means "keep existing" on update
  const s = String(v).trim();
  try {
    const json = JSON.parse(s);
    if (Array.isArray(json)) {
      return json
        .map((it) =>
          it && typeof it === "object" && it.key
            ? { key: String(it.key), value: String(it.value ?? "") }
            : null
        )
        .filter(Boolean);
    }
    if (json && typeof json === "object") {
      return Object.entries(json).map(([k, val]) => ({
        key: String(k),
        value: String(val ?? ""),
      }));
    }
  } catch {}
  // Fallback: key=value|key2:value2
  return splitPipe(s).map((p) => {
    const [k, ...rest] = p.split(/[:=]/);
    return { key: (k || "").trim(), value: rest.join(":").trim() };
  });
};

async function uploadBufferToCloudinary(buffer, filename, kind) {
  // Kind: "image" | "video"
  // Configure Cloudinary (idempotent)
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "ecommerce-products/bulk",
          resource_type: kind,
          use_filename: true,
          unique_filename: true,
          filename_override: sanitizeFilename(filename),
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result?.secure_url || result?.url);
        }
      )
      .end(buffer);
  });
}

async function storeMedia(fileName, buffer) {
  const ext = extOf(fileName);
  const kind = IMG_EXT.has(ext) ? "image" : VID_EXT.has(ext) ? "video" : null;
  if (!kind) throw new Error("Unsupported media type: " + ext);

  if (STORAGE_MODE === "cloud") {
    return await uploadBufferToCloudinary(buffer, fileName, kind);
  }

  const dir = await ensureUploadsDir();
  const outName = `${Date.now()}-${sanitizeFilename(fileName)}`;
  const fullPath = path.join(dir, outName);
  await fsp.writeFile(fullPath, buffer);
  return `/uploads/${outName}`;
}

async function resolveCategory({ category_id, category_slug }) {
  if (category_id) {
    const byId = await Category.findById(category_id).lean();
    if (byId) return byId;
  }
  if (category_slug) {
    const slug = String(category_slug).toLowerCase();
    const bySlug = await Category.findOne({ slug }).lean();
    if (bySlug) return bySlug;
  }
  return null;
}

// CSV helpers to ensure proper quoting (RFC 4180-ish)
const csvQuote = (val) => {
  const s = String(val ?? "");
  const needs =
    s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r");
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
};
const toCsvRow = (vals) => vals.map(csvQuote).join(",");

export const downloadTemplate = async (_req, res) => {
  const headers = toCsvRow([
    "title",
    "price",
    "stock",
    "category_id",
    "category_slug",
    "description",
    "sku",
    "brand",
    "discountPrice",
    "tags", // comma-separated
    "attributes", // JSON or key=value|key2=value2
    "seoTitle",
    "seoDescription",
    "shipWeight",
    "shipLength",
    "shipWidth",
    "shipHeight",
    "images", // pipe-delimited filenames or absolute URLs; max 5 used
    "video", // filename in ZIP or absolute URL
  ]);

  const exampleRow = toCsvRow([
    "Wireless Noise-Cancelling Headphones",
    "4999",
    "25",
    "", // category_id
    "electronics", // category_slug
    "Immersive sound with active noise cancellation.",
    "WH-1000XM-sku",
    "Luxora",
    "4499",
    "featured, limited, new",
    '{"color":"Black","battery":"30h"}',
    "Premium ANC Headphones",
    "Best-in-class noise cancellation for long flights",
    "0.45",
    "20",
    "18",
    "5",
    "1.jpg|2.jpg|3.jpg",
    "1.mp4",
  ]);

  const csv = `${headers}\n${exampleRow}\n`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="luxora_seller_products_template.csv"'
  );
  res.status(200).send(csv);
};

export const importBulk = async (req, res) => {
  try {
    const sellerId = req.sellerId; // set by withSellerScope
    if (!sellerId) {
      return res.status(400).json({ message: "Seller scope not set" });
    }

    const csvFile = req.files?.csv?.[0];
    if (!csvFile)
      return res.status(400).json({ message: "CSV file is required" });

    const zipFile = req.files?.media?.[0]; // optional
    let zipIndex = new Map();
    if (zipFile) {
      const zip = new AdmZip(zipFile.buffer);
      for (const e of zip.getEntries()) {
        if (e.isDirectory) continue;
        const base = path.basename(e.entryName).toLowerCase();
        if (!zipIndex.has(base)) zipIndex.set(base, e); // first occurrence wins
      }
    }

    const rows = parseCsv(csvFile.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // handle UTF-8 BOM from Excel
    });

    const errors = [];
    let created = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const raw = rows[i];
      const r = {};
      for (const [k, v] of Object.entries(raw)) {
        r[String(k).toLowerCase()] = typeof v === "string" ? v.trim() : v;
      }

      const title = r.title || "";
      const price = toNumber(r.price);
      const stock = toInt(r.stock);
      const description = r.description || "";
      const sku = r.sku || "";
      const brand = r.brand || "";
      const discountPrice = toNumber(r.discountprice);
      const tagsStr = r.tags || "";
      const attributes = parseAttributes(r.attributes);
      const seoTitle = r.seotitle || "";
      const seoDescription = r.seodescription || "";
      const shipWeight = toNumber(r.shipweight);
      const shipLength = toNumber(r.shiplength);
      const shipWidth = toNumber(r.shipwidth);
      const shipHeight = toNumber(r.shipheight);
      const imagesSpec = r.images || "";
      const videoSpec = r.video || "";
      const category_id = r.category_id || "";
      const category_slug = r.category_slug || "";

      const rowIssues = [];
      if (!title) rowIssues.push("Missing title");
      if (price === null || price < 0) rowIssues.push("Invalid price");
      if (stock === null || stock < 0) rowIssues.push("Invalid stock");
      if (!category_id && !category_slug)
        rowIssues.push("Provide category_id or category_slug");

      let catDoc = null;
      if (!rowIssues.length) {
        catDoc = await resolveCategory({ category_id, category_slug });
        if (!catDoc) {
          rowIssues.push(
            `Unknown category (id="${category_id}" slug="${category_slug}")`
          );
        }
      }

      if (rowIssues.length) {
        errors.push({ row: rowNum, sku, title, error: rowIssues.join("; ") });
        continue;
      }

      // Collect images (max 5) and optional video
      const images = [];
      const imageNames = splitPipe(imagesSpec);
      const imgOverflow = imageNames.length > 5;
      const namesToUse = imageNames.slice(0, 5);

      const missingImages = [];
      for (const name of namesToUse) {
        if (!name) continue;
        if (isHttpUrl(name)) {
          images.push({ url: name, alt: title });
          continue;
        }
        const base = path.basename(name).toLowerCase();
        const entry = zipIndex.get(base);
        if (!entry) {
          missingImages.push(name);
          continue;
        }
        try {
          const buf = entry.getData();
          const url = await storeMedia(base, buf);
          images.push({ url, alt: title });
        } catch {
          missingImages.push(name);
        }
      }

      let videoUrl = "";
      if (videoSpec) {
        if (isHttpUrl(videoSpec)) {
          videoUrl = videoSpec;
        } else {
          const base = path.basename(videoSpec).toLowerCase();
          const entry = zipIndex.get(base);
          if (entry) {
            try {
              const buf = entry.getData();
              videoUrl = await storeMedia(base, buf);
            } catch {
              errors.push({
                row: rowNum,
                sku,
                title,
                error: `Failed to store video "${videoSpec}"`,
              });
            }
          } else {
            errors.push({
              row: rowNum,
              sku,
              title,
              error: `Video "${videoSpec}" not found in ZIP`,
            });
          }
        }
      }

      if (missingImages.length) {
        errors.push({
          row: rowNum,
          sku,
          title,
          error: `Missing images in ZIP: ${missingImages.join(", ")}`,
        });
      }
      if (imgOverflow) {
        errors.push({
          row: rowNum,
          sku,
          title,
          error: `Images exceed limit (5). Extra entries ignored.`,
        });
      }

      const tags = splitComma(tagsStr);
      const shipping = {};
      if (shipWeight != null) shipping.weight = shipWeight;
      if (shipLength != null) shipping.length = shipLength;
      if (shipWidth != null) shipping.width = shipWidth;
      if (shipHeight != null) shipping.height = shipHeight;
      const seo = {};
      if (seoTitle) seo.title = seoTitle;
      if (seoDescription) seo.description = seoDescription;

      let doc = null;
      if (sku) {
        doc = await Product.findOne({ owner: sellerId, sku });
      }

      try {
        if (!doc) {
          // Create new
          const newDoc = new Product({
            owner: sellerId,
            title,
            description,
            price,
            stock,
            category: catDoc.name, // store category name (ProductForm style)
            tags,
            images: images,
            videoUrl: videoUrl || undefined,
            sku: sku || undefined,
            brand: brand || undefined,
            discountPrice: discountPrice ?? undefined,
            attributes: attributes ?? [],
            seo: Object.keys(seo).length ? seo : undefined,
            shipping: Object.keys(shipping).length ? shipping : undefined,
          });
          await newDoc.save();
          created++;
        } else {
          // Update existing
          doc.title = title || doc.title;
          doc.description = description ?? doc.description;
          if (price !== null) doc.price = price;
          if (stock !== null) doc.stock = stock;
          doc.category = catDoc.name || doc.category;
          if (brand) doc.brand = brand;
          if (discountPrice !== null) doc.discountPrice = discountPrice;
          if (tagsStr) doc.tags = tags;

          if (images.length) {
            const existing = Array.isArray(doc.images) ? doc.images : [];
            const combined = [...existing, ...images];
            // de-duplicate by url
            const seen = new Set();
            doc.images = combined.filter((im) => {
              const u = im?.url || "";
              if (seen.has(u)) return false;
              seen.add(u);
              return true;
            });
          }

          if (videoUrl) doc.videoUrl = videoUrl;

          if (attributes !== undefined) {
            doc.attributes = attributes;
          }
          if (Object.keys(seo).length) {
            doc.seo = { ...(doc.seo || {}), ...seo };
          }
          if (Object.keys(shipping).length) {
            doc.shipping = { ...(doc.shipping || {}), ...shipping };
          }

          await doc.save();
          updated++;
        }
      } catch (e) {
        errors.push({
          row: rowNum,
          sku,
          title,
          error: e?.message || "Failed to save product",
        });
      }
    }

    return res.json({
      ok: true,
      summary: { rows: rows.length, created, updated, errors: errors.length },
      errors,
    });
  } catch (err) {
    console.error("seller bulk import error:", err);
    return res.status(500).json({ message: "Import failed" });
  }
};
