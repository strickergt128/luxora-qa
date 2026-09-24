import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import upload from "../config/storage.js";
import { logAdminAction } from "../utils/adminLog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export const listMedia = async (req, res) => {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const stats = await Promise.all(
      files.map(async (f) => {
        const st = await fs.stat(path.join(UPLOAD_DIR, f));
        return {
          filename: f,
          size: st.size,
          mtime: st.mtime,
          url: `/uploads/${f}`,
        };
      })
    );
    res.json(stats.sort((a, b) => b.mtime - a.mtime));
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// reuse multer storage; ensure local mode
export const uploadMedia = [
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file" });
    const url =
      process.env.STORAGE_MODE === "cloud"
        ? req.file.path
        : `/uploads/${req.file.filename}`;

    await logAdminAction(req, {
      action: "media.upload",
      entityType: "media",
      entityId: req.file.filename,
      summary: `Uploaded file ${req.file.originalname || req.file.filename}`,
      before: null,
      after: { filename: req.file.filename, url },
    });

    res.status(201).json({ filename: req.file.filename, url });
  },
];

export const deleteMedia = async (req, res) => {
  try {
    const raw = req.params.filename || "";

    // Decode and sanitize
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {}
    decoded = decoded.replace(/^\/?uploads\//i, "").replace(/^\//, "");
    const filename = path.basename(decoded);

    if (
      !filename ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    const filePath = path.join(UPLOAD_DIR, filename);

    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err?.code === "ENOENT") {
        // If you prefer idempotent delete, return 200 here instead of 404
        return res.status(404).json({ message: "File not found" });
      }
      throw err;
    }

    // Log, but don't let logging errors bubble up
    try {
      await logAdminAction(req, {
        action: "media.delete",
        entityType: "media",
        entityId: filename,
        summary: `Deleted file ${filename}`,
        before: { filename },
        after: null,
      });
    } catch (e) {
      console.error("[adminLog] media.delete failed:", e?.message || e);
      // continue; do not throw
    }

    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("[media] delete failed:", err?.message || err);
    return res.status(500).json({ message: "Delete failed" });
  }
};

