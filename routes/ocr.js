const express = require("express");
const { ImageAnnotatorClient } = require("@google-cloud/vision");

const router = express.Router();
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
const client = new ImageAnnotatorClient({ credentials });

router.post("/", async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: "No image URL provided" });
    }

    // Download the image
    console.log("🌐 Downloading image from URL:", imageUrl);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(400).json({ message: "Failed to download image" });
    }

    const buffer = await response.arrayBuffer(); // Node fetch returns arrayBuffer
    const imageContent = {
      content: Buffer.from(buffer).toString("base64"),
    };

    const [result] = await client.textDetection({
      image: imageContent,
    });

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
