// backend/src/controllers/categoryController.js
import Category from "../models/Category.js";

export const listCategories = async (_req, res) => {
  try {
    const cats = await Category.find({ active: true }).sort({ name: 1 }).lean();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Admin only
export const createCategory = async (req, res) => {
  try {
    const { name, active = true } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });
    const exists = await Category.findOne({ name });
    if (exists) return res.status(400).json({ message: "Category exists" });
    const cat = await Category.create({ name, active });
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { name, active } = req.body;
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: "Not found" });
    if (name !== undefined) cat.name = name;
    if (active !== undefined) cat.active = !!active;
    await cat.save();
    res.json(cat);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// BULK IMPORT: body { items: [{ name, active? }, ...] }
export const importCategories = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items[] required" });
    }

    const toInsert = [];
    for (const raw of items) {
      const name = String(raw.name || "").trim();
      if (!name) continue;
      const exists = await Category.findOne({ name });
      if (!exists) toInsert.push({ name, active: raw.active !== false });
    }
    if (toInsert.length === 0) {
      return res.json({ inserted: 0, message: "Nothing to import" });
    }
    const inserted = await Category.insertMany(toInsert);
    res.json({ inserted: inserted.length });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};

