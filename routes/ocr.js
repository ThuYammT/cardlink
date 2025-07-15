const express = require("express");
const multer = require("multer");
const vision = require("@google-cloud/vision");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

router.post("/", upload.single("image"), async (req, res) => {
  try {
    // 🧪 1. Check for file
    if (!req.file) {
      console.log("❌ No file received in OCR endpoint.");
      return res.status(400).json({ message: "No image uploaded" });
    }

    console.log("✅ OCR request received:", req.file.originalname);

    // 🧠 2. Google Vision API call
    const [result] = await client.textDetection({
      image: { content: req.file.buffer },
    });

    if (!result.fullTextAnnotation || !result.fullTextAnnotation.text) {
      console.log("❌ No text detected in image.");
      return res.status(400).json({ message: "No text detected in image" });
    }

    const rawText = result.fullTextAnnotation.text;
    console.log("📄 OCR raw text:", rawText.slice(0, 200)); // log first 200 chars

    // 🧠 3. Simple regex-based NLP fallback
    const emailMatch = rawText.match(/\S+@\S+\.\S+/);
    const phoneMatches = rawText.match(/(\+?\d[\d\s\-().]{7,}\d)/g);

    const contact = {
      firstName: "", // Improve with NLP later
      lastName: "",
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatches?.[0] || "",
      additionalPhones: phoneMatches?.slice(1) || [],
      company: "", // Optional: parse company name later
      website: "", // Optional: add website match
      notes: rawText,
      nickname: "",
      position: "",
    };

    res.json(contact);
  } catch (err) {
    console.error("❌ OCR error:", err.message);
    res.status(500).json({ message: "OCR processing failed" });
  }
});

module.exports = router;
