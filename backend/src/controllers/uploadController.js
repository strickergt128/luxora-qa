export const uploadFile = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const fileUrl =
      process.env.STORAGE_MODE === "cloud"
        ? req.file.path
        : `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

