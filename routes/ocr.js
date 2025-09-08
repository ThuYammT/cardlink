const express = require("express");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const parseOCRText = require("../utils/parseOCRText");
const cloudinary = require("cloudinary").v2;
const runSpaCyNER = require("../utils/ner");

const router = express.Router();

cloudinary.config({
  cloud_name: "dwmav1imw",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Preprocess image with Sharp
async function preprocessImage(buffer) {
  console.log("🖼️ Preprocessing image with Sharp...");
  return sharp(buffer).grayscale().normalize().sharpen().toBuffer();
}

// Clean noisy OCR text
function normalizeOCRNoise(text) {
  return (text || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[|=]+/g, " ")
    .replace(/Il/g, "II")
    .replace(/\b0([89]\d{8})\b/, "+66$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

router.post("/", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: "Missing imageUrl" });
    }

    console.log("📥 Fetching image:", imageUrl);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(400).json({ message: "Failed to fetch image" });
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Preprocess
    const processedBuffer = await preprocessImage(buffer);

    // OCR
    console.log("🔠 Running OCR...");
    const { data } = await Tesseract.recognize(processedBuffer, "eng", {
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.:,+-()& ",
    });

    let cleanText = "";
    if (Array.isArray(data.words) && data.words.length > 0) {
      cleanText = data.words
        .filter((w) => w.confidence >= 70)
        .map((w) => w.text)
        .join(" ");
    } else {
      console.warn("⚠️ No word-level data found, falling back to raw text.");
      cleanText = data.text || "";
    }

    const cleaned = normalizeOCRNoise(cleanText);

    console.log("🧠 OCR raw text (first 200 chars):", (data.text || "").slice(0, 200));
    console.log("🧼 OCR cleaned text (first 200 chars):", cleaned.slice(0, 200));

    // Step 1: regex parser (phones, emails, etc.)
    console.log("📝 Running regex parser...");
    const parsed = parseOCRText(cleaned);

    // Add fullName field
    parsed.fullName = { value: "", confidence: 0 };

    // Step 2: call spaCy NER
    console.log("🤖 Calling spaCy NER...");
    const entities = await runSpaCyNER(cleaned);
    console.log("🔍 NER entities:", entities);

    // Step 3: merge
    console.log("⚡ Merging NER with regex results...");

    let nameSet = false;

    for (const e of entities) {
      if (!nameSet && (e.label === "FULLNAME" || e.label === "PERSON")) {
        parsed.fullName = { value: e.text, confidence: 0.95 };
        console.log("✅ FULLNAME chosen:", parsed.fullName.value);

        // Optional split
        const parts = e.text.trim().split(/\s+/);
        if (parts.length >= 2) {
          parsed.firstName = { value: parts[0], confidence: 0.9 };
          parsed.lastName = { value: parts.slice(1).join(" "), confidence: 0.9 };
        } else {
          parsed.firstName = { value: e.text.trim(), confidence: 0.9 };
        }

        nameSet = true;
      }

      if (e.label === "ORG") {
        parsed.company = { value: e.text, confidence: 0.95 };
        console.log("✅ ORG override:", parsed.company);
      }

      if (e.label === "TITLE") {
        parsed.position = { value: e.text, confidence: 0.9 };
        console.log("✅ TITLE override:", parsed.position);
      }
    }

    parsed.cardImageUrl = imageUrl;

    console.log("🎯 Final parsed result:", JSON.stringify(parsed, null, 2));
    res.json(parsed);
  } catch (err) {
    console.error("❌ OCR error:", err);
    res.status(500).json({ message: "OCR processing failed", detail: err.message });
  }
});

module.exports = router;
