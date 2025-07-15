const express = require("express");
const vision = require("@google-cloud/vision");

const router = express.Router();
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

router.post("/", async (req, res) => {
  try {
    const imageUrl = req.body.imageUrl;

    if (!imageUrl) {
      return res.status(400).json({ message: "No image URL provided" });
    }

    console.log("🌐 Vision API using URL:", imageUrl);

    const [result] = await client.textDetection({
      image: {
        source: {
          imageUri: imageUrl, // ✅ CORRECT USAGE
        },
      },
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
    res.status(500).json({ message: "OCR processing failed", detail: err.message });
  }
});

module.exports = router;
