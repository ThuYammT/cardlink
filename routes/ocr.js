const express = require("express");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const parseOCRText = require("../utils/parseOCRText");
const cloudinary = require("cloudinary").v2;
const { LanguageServiceClient } = require("@google-cloud/language");

const router = express.Router();
const client = new LanguageServiceClient(); // Google NLP client

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

// Call Google NLP API
async function runGoogleNLP(text) {
  const document = { content: text, type: "PLAIN_TEXT" };
  const [result] = await client.analyzeEntities({ document });
  const entities = result.entities.map((ent) => ({
    text: ent.name,
    label: ent.type, // PERSON, ORGANIZATION, PHONE_NUMBER, EMAIL, LOCATION
    salience: ent.salience,
  }));
  console.log("🔍 Google NLP entities:", entities);
  return entities;
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

    // Step 1: regex parser
    console.log("📝 Running regex parser...");
    const parsed = parseOCRText(cleaned);

    // Step 2: Google NLP
    console.log("🤖 Calling Google NLP...");
    const entities = await runGoogleNLP(cleaned);

    // Step 3: merge
console.log("⚡ Merging NLP with regex results...");

// Known job title keywords
const TITLE_WORDS = [
  "Manager","Executive","Director","Officer","Founder","Chairperson",
  "President","Professor","Lecturer","Engineer","Consultant","Analyst",
  "Specialist","Coordinator","Advisor","Assistant","Associate","CEO","CTO","CFO","COO","Dean","Researcher"
];

// Helper: clean PERSON names
function cleanPersonName(text) {
  let words = text.trim().split(/\s+/);
  // Remove title words at the end
  while (words.length > 1 && TITLE_WORDS.includes(words[words.length - 1])) {
    words.pop();
  }
  return words.join(" ");
}

  // Helper: check if text looks like a real name
function isLikelyName(text) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  return words.every(w => /^[A-Z][a-z]+$/.test(w));
}

// PERSON
let personEntities = entities.filter((e) => e.label === "PERSON");

if (personEntities.length > 0) {
  // Compute scores
  personEntities = personEntities.map(e => {
    const cleanedName = cleanPersonName(e.text);
    return {
      ...e,
      cleanedName,
      nameScore: isLikelyName(cleanedName) ? 1 : 0
    };
  });

  // Sort: prefer real names > salience
  const best = personEntities.sort((a, b) => {
    if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
    return b.salience - a.salience;
  })[0];

  parsed.fullName = { value: best.cleanedName, confidence: 0.95 };
  console.log("✅ PERSON chosen:", parsed.fullName.value);

  const parts = best.cleanedName.split(/\s+/);
  if (parts.length >= 2) {
    parsed.firstName = { value: parts[0], confidence: 0.9 };
    parsed.lastName = { value: parts.slice(1).join(" "), confidence: 0.9 };
  } else {
    parsed.firstName = { value: best.cleanedName, confidence: 0.9 };
  }
} else {
  console.log("⚠️ No PERSON found, fallback to regex/email.");
  if (parsed.email.value) {
    const local = parsed.email.value.split("@")[0];
    parsed.firstName = { value: local, confidence: 0.6 };
  }
}


  // ORG
  const org = entities.find((e) => e.label === "ORGANIZATION");
  if (org) {
    let orgName = org.text.trim();
    // Trim out extra department/address terms
    if (orgName.length > 50 || /\b(Campus|Department|School|Road|Rd|Street|Thailand)\b/i.test(orgName)) {
      const simple = orgName.split(/,|Department|School|Campus/)[0].trim();
      if (simple.length > 2) orgName = simple;
    }
    parsed.company = { value: orgName, confidence: 0.95 };
    console.log("✅ ORG override:", parsed.company);
  }

  // EMAIL
  const emailEnt = entities.find((e) => e.label === "EMAIL");
  if (emailEnt) {
    parsed.email = { value: emailEnt.text, confidence: 0.95 };
    console.log("✅ EMAIL override:", parsed.email);
  }

  // PHONE
  const phoneEnt = entities.find((e) => e.label === "PHONE_NUMBER");
  if (phoneEnt) {
    parsed.phone = { value: phoneEnt.text, confidence: 0.9 };
    console.log("✅ PHONE override:", parsed.phone);
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
