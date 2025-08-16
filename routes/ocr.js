const express = require("express");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const parseOCRText = require("../utils/parseOCRText");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// ✅ Configure Cloudinary (use your credentials here or env variables)
cloudinary.config({
  cloud_name: "dwmav1imw", // your cloud name
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post("/", async (req, res) => {
  try {
    const { imageUrl } = req.body; // ✅ expect URL
    if (!imageUrl) {
      return res.status(400).json({ message: "Missing imageUrl" });
    }

    // 🖼 Download image from Cloudinary URL
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const jpegBuffer = Buffer.from(arrayBuffer);

    // 🧠 OCR
    const { data: { text } } = await Tesseract.recognize(jpegBuffer, "eng", {
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.:,+-()& ",
    });

    console.log("🧠 OCR text:", text.slice(0, 150));
    const parsed = parseOCRText(text);

    // ✅ Attach Cloudinary image URL
    parsed.cardImageUrl = imageUrl;

    res.json(parsed);
  } catch (err) {
    console.error("❌ OCR error:", err);
    res.status(500).json({ message: "OCR processing failed", detail: err.message });
  }
});


module.exports = router;
