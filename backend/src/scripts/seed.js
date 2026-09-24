import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Product from "../models/Product.js";

// Initialize environment variables if needed
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/luxora";

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    console.log("Cleared existing Users and Products");

    // Create Admin
    const admin = new User({
      name: "Admin Boss",
      email: "admin@luxora.com",
      password: "password123", // Will be hashed by pre-save
      role: "admin",
      status: "active",
      permissions: ["MANAGE_USERS", "MANAGE_ROLES", "MANAGE_SYSTEM"]
    });
    
    // Create Seller
    const seller = new User({
      name: "Luxury Boutique",
      email: "seller@luxora.com",
      password: "password123",
      role: "seller",
      status: "active",
      seller: { approved: true, approvedAt: new Date() },
      sellerApplication: {
        businessName: "Raw Luxury Co",
        legalName: "Raw Luxury LLC",
        phone: "1234567890",
        address: "123 Brutalist Way, NY",
        status: "approved"
      }
    });

    // Create regular User
    const user = new User({
      name: "Test Customer",
      email: "user@luxora.com",
      password: "password123",
      role: "user",
      status: "active"
    });

    await Promise.all([admin.save(), seller.save(), user.save()]);
    console.log("Created users: Admin, Seller, and User successfully");

    // Create real-looking fake products
    const products = [
      {
        title: "Obsidian Chronograph X1",
        slug: "obsidian-chronograph-x1-01",
        description: "A masterclass in modern horology. Featuring a matte black titanium case, carbon fiber dial, and aggressive geometric styling that defies convention.",
        price: 12500,
        stock: 15,
        category: "Watches",
        brand: "Luxora",
        sku: "LUX-WX1-OBS",
        owner: seller._id,
        status: "active",
        avgRating: 4.8,
        ratingsCount: 24,
        images: [
          { url: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&q=80", alt: "Black Chronograph Watch" }, 
          { url: "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800&q=80", alt: "Watch detail" }
        ]
      },
      {
        title: "Geometric Gold Pendant",
        slug: "geometric-gold-pendant-02",
        description: "Solid 18k gold cast into a severe, brutalist structure. This piece captures light through harsh angles and unbroken planes.",
        price: 8900,
        stock: 5,
        category: "Jewelry",
        brand: "Aura",
        sku: "AUR-JP1-GLD",
        owner: seller._id,
        status: "active",
        avgRating: 5.0,
        ratingsCount: 8,
        images: [
          { url: "https://images.unsplash.com/photo-1599643478514-4a410f052594?w=800&q=80", alt: "Gold Pendant" }, 
          { url: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80", alt: "Jewelry close up" }
        ]
      },
      {
        title: "Titanium Cuff Links",
        slug: "titanium-cuff-links-03",
        description: "Industrial strength meets executive elegance. These cuff links bring a raw, unfinished mechanical aesthetic to formal wear.",
        price: 450,
        stock: 42,
        category: "Accessories",
        brand: "Forge",
        sku: "FOR-CL-TI2",
        owner: seller._id,
        status: "active",
        avgRating: 4.5,
        ratingsCount: 12,
        images: [
          { url: "https://images.unsplash.com/photo-1620656798579-24f6f8fb0ab2?w=800&q=80", alt: "Cuff Links" }
        ]
      },
      {
        title: "Midnight Leather Briefcase",
        slug: "midnight-leather-briefcase-04",
        description: "Full-grain Italian leather treated to a pitch black finish. Featuring heavy brass hardware and stark, blocky proportions.",
        price: 2100,
        stock: 8,
        category: "Leather",
        brand: "Hide & Co",
        sku: "HC-LBG-BLK",
        owner: seller._id,
        status: "active",
        avgRating: 4.9,
        ratingsCount: 31,
        images: [
          { url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80", alt: "Leather Briefcase" }, 
          { url: "https://images.unsplash.com/photo-1547949003-9792a18a2601?w=800&q=80", alt: "Briefcase open" }
        ]
      },
      {
        title: "Skeleton Automatic Watch",
        slug: "skeleton-automatic-watch-05",
        description: "Exposing the intricate mechanical heart. Bold, transparent, and unapologetically complex. Sapphire crystal front and back.",
        price: 18500,
        stock: 3,
        category: "Watches",
        brand: "Luxora",
        sku: "LUX-SWA-T1",
        owner: seller._id,
        status: "active",
        avgRating: 4.7,
        ratingsCount: 15,
        images: [
          { url: "https://images.unsplash.com/photo-1548171915-e7afaca931cb?w=800&q=80", alt: "Skeleton Watch Dial" }, 
          { url: "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=800&q=80", alt: "Watch Movement Mechanics" }
        ]
      }
    ];

    await Product.insertMany(products);
    console.log("Fake products seeded successfully");

    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedData();
