const express = require("express");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: "Missing base64 image" });
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const jpegBuffer = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();

    const { data: { text } } = await Tesseract.recognize(jpegBuffer, "eng");

    console.log("🧠 OCR text:", text.slice(0, 150));

    // Simple parsing
    const emailMatch = text.match(/\S+@\S+\.\S+/);
    const phoneMatches = text.match(/(\+?\d[\d\s\-().]{7,}\d)/g);

    const contact = {
      firstName: "",
      lastName: "",
      email: emailMatch?.[0] || "",
      phone: phoneMatches?.[0] || "",
      additionalPhones: phoneMatches?.slice(1) || [],
      company: "",
      website: "",
      notes: text,
      nickname: "",
      position: "",
    };

    res.json(contact);
  } catch (err) {
    console.error("❌ Tesseract OCR error:", err);
    res.status(500).json({ message: "OCR processing failed", detail: err.message });
  }
});

module.exports = router;
