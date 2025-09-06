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

// OCR preprocessing with Sharp
async function preprocessImage(buffer) {
  console.log("🖼️ Preprocessing image with Sharp...");
  return sharp(buffer).grayscale().normalize().sharpen().toBuffer();
}

// Noise cleaner (extra filter)
function normalizeOCRNoise(text) {
  return (text || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[|=]+/g, " ")
    .replace(/Il/g, "II")
    .replace(/\b0([89]\d{8})\b/, "+66$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function filterNoiseLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 2 &&
        !/^[A-Z]{2,3}$/.test(l) && // remove short all-caps junk like TE, EE
        !/^[^a-zA-Z0-9]+$/.test(l) // remove lines that are only symbols
    )
    .join("\n");
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

    // Preprocess with Sharp
    const processedBuffer = await preprocessImage(buffer);

    // Run OCR
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

    // Normalize & filter noise
    let cleaned = normalizeOCRNoise(cleanText);
    cleaned = filterNoiseLines(cleaned);

    console.log("🧠 OCR raw text (first 200 chars):", (data.text || "").slice(0, 200));
    console.log("🧼 OCR cleaned text (first 200 chars):", cleaned.slice(0, 200));

    // Regex parser
    console.log("📝 Running regex parser...");
    const parsed = parseOCRText(cleaned);

    // NER extraction
    console.log("🤖 Calling spaCy NER...");
    const entities = await runSpaCyNER(cleaned);
    console.log("🔍 NER entities:", entities);

    // Merge results
    console.log("⚡ Merging NER with regex...");
    entities.forEach((e) => {
      if (e.label === "PERSON") {
        const parts = e.text.split(/\s+/);
        if (parts.length >= 2) {
          parsed.firstName = { value: parts[0], confidence: 0.95 };
          parsed.lastName = { value: parts.slice(1).join(" "), confidence: 0.95 };
          console.log("✅ PERSON override:", parsed.firstName, parsed.lastName);
        }
      }

      if (e.label === "ORG") {
        if (!parsed.company.value || parsed.company.confidence < 0.9) {
          parsed.company = { value: e.text, confidence: 0.95 };
          console.log("✅ ORG override:", parsed.company);
        }
      }

      if (e.label === "TITLE") {
        parsed.position = { value: e.text, confidence: 0.9 };
        console.log("✅ TITLE override:", parsed.position);
      }
    });

    parsed.cardImageUrl = imageUrl;

    console.log("🎯 Final parsed result:", JSON.stringify(parsed, null, 2));
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
