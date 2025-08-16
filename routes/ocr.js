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
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: "Missing base64 image" });
    }

    // 🖼 Convert to buffer & compress
    const buffer = Buffer.from(imageBase64, "base64");
    const jpegBuffer = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();

    // ⬆️ Upload compressed image to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload_stream(
      { folder: "cardlink/cards" }, // optional folder
      async (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload error:", error);
          return res.status(500).json({ message: "Image upload failed" });
        }

        // 🧠 OCR once upload is done
        const { data: { text } } = await Tesseract.recognize(jpegBuffer, "eng", {
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.:,+-()& ",
        });

        console.log("🧠 OCR text:", text.slice(0, 150));
        const parsed = parseOCRText(text);

        // ✅ Attach Cloudinary image URL
        parsed.cardImageUrl = result.secure_url;

        res.json(parsed);
      }
    );

    // 🔗 Pipe buffer to Cloudinary upload
    require("streamifier").createReadStream(jpegBuffer).pipe(uploadResponse);

  } catch (err) {
    console.error("❌ OCR error:", err);
    res.status(500).json({ message: "OCR processing failed", detail: err.message });
  }
});

module.exports = router;
