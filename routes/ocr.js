const express = require("express");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const parseOCRText = require("../utils/parseOCRText");
const cloudinary = require("cloudinary").v2;
const runSpaCyNER = require("../utils/ner"); // NEW

const router = express.Router();

cloudinary.config({
  cloud_name: "dwmav1imw",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(400).json({ message: "Failed to fetch image" });
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    const { data } = await Tesseract.recognize(buffer, "eng", {
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

    console.log("🧠 OCR raw text:", (data.text || "").slice(0, 150));
    console.log("🧼 OCR cleaned text:", cleaned.slice(0, 150));

    const parsed = parseOCRText(cleaned);

    // 🔍 Run spaCy NER and merge results
    const entities = await runSpaCyNER(cleaned);
    console.log("🔍 NER entities:", entities);

    entities.forEach((e) => {
  if (e.label === "PERSON") {
    if (!parsed.firstName.value || parsed.firstName.confidence < 0.9) {
      const parts = e.text.split(" ");
      parsed.firstName = { value: parts[0], confidence: 0.95 };
      parsed.lastName = { value: parts.slice(1).join(" "), confidence: 0.95 };
    }
  }

  if (e.label === "ORG") {
    if (!parsed.company.value || parsed.company.confidence < 0.9) {
      parsed.company = { value: e.text, confidence: 0.9 };
    }
  }
});


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
