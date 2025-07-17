const express = require("express");
const vision = require("@google-cloud/vision");
const fetch = require("node-fetch"); // Make sure to install: npm install node-fetch

const router = express.Router();
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

router.post("/", async (req, res) => {
  try {
    const { imageUrl, imageBase64 } = req.body;

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ message: "No image data provided" });
    }

    let imageContent;
    if (imageBase64) {
      // Use base64 if provided
      imageContent = { content: imageBase64 };
    } else {
      // Fallback to downloading the image
      console.log("🌐 Downloading image from URL:", imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(400).json({ message: "Failed to download image" });
      }
      const buffer = await response.buffer();
      imageContent = { content: buffer.toString('base64') };
    }

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
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;