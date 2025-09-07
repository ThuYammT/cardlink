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

// ---------- Image preprocessing ----------
async function preprocessImage(buffer) {
  console.log("🖼️ Preprocessing image with Sharp...");
  return sharp(buffer)
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(180) // mild binarization; remove if it hurts certain cards
    .toBuffer();
}

// ---------- OCR text cleanup ----------
function normalizeOCRNoise(text) {
  return (text || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[|=]+/g, " ")
    .replace(/Il/g, "II")
    .replace(/\b0([89]\d{8})\b/, "+66$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// If OCR collapsed to one long line, insert soft breaks before common labels
function injectLabelBreaks(text) {
  return (text || "")
    .replace(/\s+(Tel\.?|Phone|Mobile|Mob\.?|Cell|Fax)\s*:/gi, "\n$1: ")
    .replace(/\s+E-?mail\s*:/gi, "\nE-mail: ")
    .replace(/\s+Email\s*:/gi, "\nEmail: ")
    .replace(/\s+Web(?:site)?\s*:/gi, "\nWebsite: ");
}

function filterNoiseLines(text) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim());

  return lines
    .filter((l) =>
      l &&
      l.length > 2 &&
      !/^[A-Z]{2,3}$/.test(l) &&          // remove short all-caps junk like TE, EE
      !/^[^a-zA-Z0-9]+$/.test(l)          // remove pure-symbol lines
    )
    .join("\n");
}

// ---------- Route ----------
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

    // 1) Preprocess
    const processedBuffer = await preprocessImage(buffer);

    // 2) OCR
    console.log("🔠 Running OCR...");
    const { data } = await Tesseract.recognize(processedBuffer, "eng", {
      // include '/' so URLs aren't mangled
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@./:,+-()& ",
    });

    // Prefer data.text (preserves line breaks). Fallback to words if missing.
    const rawTextForParsing =
      (data.text && data.text.trim()) ||
      (Array.isArray(data.words) && data.words.length
        ? data.words
            .filter((w) => w.confidence >= 70)
            .map((w) => w.text)
            .join(" ")
        : "");

    // 3) Cleanup pipeline
    let cleaned = normalizeOCRNoise(rawTextForParsing);
    cleaned = injectLabelBreaks(cleaned);
    cleaned = filterNoiseLines(cleaned);

    console.log("🧠 OCR raw text (first 200):", (data.text || "").slice(0, 200));
    console.log("🧼 OCR cleaned text (first 200):", cleaned.slice(0, 200));

    // 4) Regex parsing (emails/phones/website + fallbacks)
    console.log("📝 Running regex parser...");
    const parsed = parseOCRText(cleaned);

    // 5) NER extraction (names/org/title)
    console.log("🤖 Calling spaCy NER...");
    const entities = await runSpaCyNER(cleaned);
    console.log("🔍 NER entities:", entities);

    // 6) Merge (NER-first for PERSON/ORG/TITLE)
    const before = JSON.parse(JSON.stringify(parsed)); // for diff logs

    entities.forEach((e) => {
      if (e.label === "PERSON") {
        const parts = e.text.split(/\s+/);
        if (parts.length >= 2) {
          parsed.firstName = { value: parts[0], confidence: 0.95 };
          parsed.lastName = { value: parts.slice(1).join(" "), confidence: 0.95 };
        }
      }
      if (e.label === "ORG") {
        parsed.company = { value: e.text, confidence: 0.95 };
      }
      if (e.label === "TITLE") {
        parsed.position = { value: e.text, confidence: 0.9 };
      }
    });

    // Diff logs (what NER overrode)
    if (before.firstName.value !== parsed.firstName.value ||
        before.lastName.value  !== parsed.lastName.value) {
      console.log("🔁 NAME override:",
        `${before.firstName.value} ${before.lastName.value}`.trim(), "→",
        `${parsed.firstName.value} ${parsed.lastName.value}`.trim());
    }
    if (before.company.value !== parsed.company.value) {
      console.log("🔁 COMPANY override:", before.company.value, "→", parsed.company.value);
    }
    if (before.position.value !== parsed.position.value) {
      console.log("🔁 TITLE override:", before.position.value, "→", parsed.position.value);
    }

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
