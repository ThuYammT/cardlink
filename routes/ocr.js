const express = require("express");
const multer = require("multer");
const vision = require("@google-cloud/vision");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const [result] = await client.textDetection({
      image: { content: req.file.buffer },
    });

    const rawText = result.fullTextAnnotation?.text || "";

    // Simple regex-based NLP (you can improve this later)
    const contact = {
      firstName: "",
      lastName: "",
      email: rawText.match(/\S+@\S+\.\S+/)?.[0] || "",
      phone: rawText.match(/(\+?\d[\d\s-]{7,}\d)/)?.[0] || "",
      company: "",
      notes: rawText,
    };

    res.json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OCR processing failed" });
  }
});

module.exports = router;
