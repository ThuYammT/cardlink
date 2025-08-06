const express = require("express");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const parseOCRText = require("../utils/parseOCRText"); // ✅ import

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: "Missing base64 image" });
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const jpegBuffer = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();

        const {
      data: { text },
    } = await Tesseract.recognize(jpegBuffer, "eng", {
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.:,+-()& ",
    });


    console.log("🧠 OCR text:", text.slice(0, 150));

    const parsed = parseOCRText(text); // ✅ use rule-based parser

    res.json(parsed);
  } catch (err) {
    console.error("❌ Tesseract OCR error:", err);
    res
      .status(500)
      .json({ message: "OCR processing failed", detail: err.message });
  }
});

module.exports = router;
