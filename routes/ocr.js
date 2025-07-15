const express = require("express");
const multer = require("multer");
const vision = require("@google-cloud/vision");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

router.post("/", async (req, res) => {
  try {
    const imageUrl = req.body.imageUrl;
    if (!imageUrl) {
      return res.status(400).json({ message: "No image URL provided" });
    }

    console.log("🌐 OCR via URL:", imageUrl);

    const [result] = await client.textDetection({
      image: { source: { imageUri: imageUrl } },
    });

    if (!result.fullTextAnnotation || !result.fullTextAnnotation.text) {
      return res.status(400).json({ message: "No text detected" });
    }

    const rawText = result.fullTextAnnotation.text;
    const emailMatch = rawText.match(/\S+@\S+\.\S+/);
    const phoneMatches = rawText.match(/(\+?\d[\d\s\-().]{7,}\d)/g);

    const contact = {
      firstName: "",
      lastName: "",
      email: emailMatch?.[0] || "",
      phone: phoneMatches?.[0] || "",
      additionalPhones: phoneMatches?.slice(1) || [],
      company: "",
      website: "",
      notes: rawText,
      nickname: "",
      position: "",
    };

    res.json(contact);
  } catch (err) {
    console.error("❌ OCR error:", err);
    res.status(500).json({ message: "OCR processing failed", detail: err.message });
  }
});


module.exports = router;
