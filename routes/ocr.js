const express = require("express");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const parseOCRText = require("../utils/parseOCRText");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: "Missing base64 image" });
    }

    const buffer = Buffer.from(imageBase64, "base64");

    // ✅ Preprocessing: grayscale + threshold
    const processedBuffer = await sharp(buffer)
      .resize({ width: 1000 })
      .grayscale()
      .threshold(180)
      .toBuffer();

    const { data: { text } } = await Tesseract.recognize(processedBuffer, "eng", {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.:,+-()& ",
    });

    console.log("🧠 OCR raw text:\n", text);

    const parsed = parseOCRText(text);
    res.json(parsed);
  } catch (err) {
    console.error("❌ OCR error:", err);
    res.status(500).json({ message: "OCR failed", detail: err.message });
  }
});

module.exports = router;
