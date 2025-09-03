const express = require("express");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const parseOCRText = require("../utils/parseOCRText");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// ✅ Configure Cloudinary (use your credentials here or env variables)
cloudinary.config({
  cloud_name: "dwmav1imw", // your cloud name
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔧 Helper: normalize common OCR mistakes
function normalizeOCRNoise(text) {
  return (text || "")
    .replace(/[\u2013\u2014]/g, "-")     // normalize dashes
    .replace(/[|=]+/g, " ")              // remove pipes/equals
    .replace(/Il/g, "II")                // fix I vs l confusion
    .replace(/\b0([89]\d{8})\b/, "+66$1")// auto-fix Thai mobile numbers
    .replace(/\s{2,}/g, " ")             // collapse multiple spaces
    .trim();
}

router.post("/", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: "Missing imageUrl" });
    }

    // 🌐 Fetch image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(400).json({ message: "Failed to fetch image" });
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // 🧠 OCR with confidence filtering
    // 🧠 OCR with confidence filtering
const { data } = await Tesseract.recognize(buffer, "eng", {
  tessedit_char_whitelist:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.:,+-()& ",
});

let cleanText = "";

// ✅ Use words array if available, else fallback to raw text
if (Array.isArray(data.words) && data.words.length > 0) {
  cleanText = data.words
    .filter((w) => w.confidence >= 70)
    .map((w) => w.text)
    .join(" ");
} else {
  console.warn("⚠️ No word-level data found, falling back to raw text.");
  cleanText = data.text || "";
}

// Apply additional normalization
const cleaned = normalizeOCRNoise(cleanText);

console.log("🧠 OCR raw text:", (data.text || "").slice(0, 150));
console.log("🧼 OCR cleaned text:", cleaned.slice(0, 150));

// Parse structured fields
const parsed = parseOCRText(cleaned);


    // ✅ Attach Cloudinary image URL
    parsed.cardImageUrl = imageUrl;

    res.json(parsed);
  } catch (err) {
    console.error("❌ OCR error:", err);
    res.status(500).json({
      message: "OCR processing failed",
      detail: err.message,
    });
  }
});

module.exports = router;
