const express = require("express");
const multer = require("multer");
const vision = require("@google-cloud/vision");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      console.log("❌ No file received.");
      return res.status(400).json({ message: "No image uploaded" });
    }

    console.log("✅ OCR request received:", req.file.originalname);
    console.log("📦 File MIME type:", req.file.mimetype);
    console.log("📦 File size:", req.file.size, "bytes");

    // 🔧 Save image buffer to a temp file
    const tempFilePath = path.join("/tmp", `${Date.now()}-${req.file.originalname}`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    const stats = fs.statSync(tempFilePath);
    console.log("📏 Temp file size on disk:", stats.size, "bytes");

    // ✅ Use the file path with Google Vision
    const [result] = await client.textDetection(tempFilePath);

    // 🧼 Clean up the temp file
    fs.unlinkSync(tempFilePath);

    if (!result.fullTextAnnotation || !result.fullTextAnnotation.text) {
      console.log("🕵️‍♂️ No text detected by Vision API.");
      return res.status(400).json({ message: "No text detected" });
    }

    const rawText = result.fullTextAnnotation.text;
    console.log("📄 OCR raw text preview:", rawText.slice(0, 100));

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
    });
  }
});

module.exports = router;
