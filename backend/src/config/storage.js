import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import pkg from "multer-storage-cloudinary";
const { CloudinaryStorage } = pkg;

const storageMode = process.env.STORAGE_MODE || "local"; // "local" or "cloud"
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024);

const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  // Documents
  "application/pdf",
]);

const sanitizeFilename = (name = "") =>
  String(name)
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

const sharedMulterOptions = {
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
};

let upload;

if (storageMode === "cloud") {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const cloudStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "ecommerce-products",
      resource_type: "auto", // allow images and videos
      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "mp4",
        "webm",
        "mov",
        "mkv",
      ],
    },
  });

  upload = multer({ storage: cloudStorage, ...sharedMulterOptions });
} else {
  // local storage (unchanged)
  const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(process.cwd(), "uploads/"));
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + sanitizeFilename(file.originalname));
    },
  });

  upload = multer({ storage: localStorage, ...sharedMulterOptions });
}

export default upload;
