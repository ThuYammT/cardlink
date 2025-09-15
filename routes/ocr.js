const express = require("express");
const {
  DocumentAnalysisClient,
  AzureKeyCredential,
} = require("@azure/ai-form-recognizer");

const router = express.Router();

const endpoint = process.env.AZURE_DOCUMENT_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_KEY;

const client = new DocumentAnalysisClient(
  endpoint,
  new AzureKeyCredential(apiKey)
);

router.post("/", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: "Missing imageUrl" });
    }

    console.log("📥 Analyzing business card:", imageUrl);

    const poller = await client.beginAnalyzeDocumentFromUrl(
      "prebuilt-businessCard",
      imageUrl
    );
    const { documents } = await poller.pollUntilDone();

    if (!documents.length) {
      return res.status(400).json({ message: "No data extracted" });
    }

    const fields = documents[0].fields;
    console.log("📑 Azure raw fields:", JSON.stringify(fields, null, 2));

    // ✅ Extract names with fallback
    let firstName =
      fields.ContactNames?.values?.[0]?.properties?.FirstName?.content || "";
    let lastName =
      fields.ContactNames?.values?.[0]?.properties?.LastName?.content || "";

    if (!firstName && !lastName) {
      const fullName = fields.ContactNames?.values?.[0]?.content || "";
      if (fullName) {
        const parts = fullName.split(" ");
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ") || "";
      }
    }

    // ✅ Collect phones from all sources
    const phoneCandidates = [
      ...(fields.MobilePhones?.values || []),
      ...(fields.WorkPhones?.values || []),
      ...(fields.Phones?.values || []),
      ...(fields.OtherPhones?.values || []),
    ]
      .map((p) => p.content || "")
      .filter(Boolean);

    const mainPhone = phoneCandidates[0] || "";
    const additionalPhones = phoneCandidates.slice(1).map((p) => ({ value: p }));

    // ✅ Final normalized result
    const parsed = {
      firstName: { value: firstName },
      lastName: { value: lastName },
      nickname: { value: "" },
      position: { value: fields.JobTitles?.values?.[0]?.content || "" },
      phone: { value: mainPhone },
      email: { value: fields.Emails?.values?.[0]?.content || "" },
      company: { value: fields.CompanyNames?.values?.[0]?.content || "" },
      website: { value: fields.Websites?.values?.[0]?.content || "" },
      notes: { value: "" },
      additionalPhones,
      cardImageUrl: imageUrl,
    };

    // ✅ Suggestions with bounding boxes
    const suggestions = [];
    for (const [key, field] of Object.entries(fields)) {
      if (field?.values) {
        field.values.forEach((val) => {
          if (val.content) {
            suggestions.push({
              type: key,
              text: val.content,
              box: val.boundingRegions?.[0]?.polygon || [],
            });
          }
        });
      }
    }

    console.log("🎯 Final Azure parsed result:", parsed);
    res.json({ parsed, suggestions });
  } catch (err) {
    console.error("❌ Azure OCR error:", err);
    res
      .status(500)
      .json({ message: "OCR processing failed", detail: err.message });
  }
});

module.exports = router;
