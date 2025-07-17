const express = require("express");
const { ImageAnnotatorClient } = require("@google-cloud/vision");
const sharp = require("sharp");

const router = express.Router();
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
const client = new ImageAnnotatorClient({ credentials });

router.post("/", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: "Missing base64 image" });
    }

    // Decode base64 → buffer → sharp → JPEG buffer → re-encode base64
    const decodedBuffer = Buffer.from(imageBase64, "base64");
    const jpegBuffer = await sharp(decodedBuffer)
      .jpeg({ quality: 80 })
      .toBuffer();

    const image = {
      content: jpegBuffer.toString("base64"),
    };

    const [result] = await client.textDetection({ image });

    if (!result.fullTextAnnotation || !result.fullTextAnnotation.text) {
      return res.status(400).json({ message: "No text detected" });
    }

    const rawText = result.fullTextAnnotation.text;
    console.log("📄 OCR text:", rawText.slice(0, 150));

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
    res.status(500).json({
      message: "OCR processing failed",
      detail: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

module.exports = router;
