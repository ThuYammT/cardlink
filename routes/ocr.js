const express = require("express");
const multer = require("multer");
const vision = require("@google-cloud/vision");

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

    const buffer = req.file.buffer;

    const [result] = await client.textDetection({ image: { content: buffer } });

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
    res.status(500).json({ message: "OCR processing failed" });
  }
});

module.exports = router;
