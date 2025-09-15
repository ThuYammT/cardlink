const express = require("express");
const {
  DocumentAnalysisClient,
  AzureKeyCredential,
} = require("@azure/ai-form-recognizer");

const router = express.Router();

// Load from Render env vars
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

    // Call Azure prebuilt business card model
    const poller = await client.beginAnalyzeDocumentFromUrl(
      "prebuilt-businessCard",
      imageUrl
    );
    const { documents } = await poller.pollUntilDone();

    if (!documents.length) {
      return res.status(400).json({ message: "No data extracted" });
    }

    const fields = documents[0].fields;

    // 🛠️ Debug log all raw fields to see what Azure gave us
    console.log("📑 Azure raw fields:", JSON.stringify(fields, null, 2));

    // Wrap values in { value: ... } so your frontend works without changes
    const parsed = {
      firstName: {
        value:
          fields.ContactNames?.values?.[0]?.properties?.FirstName?.content || "",
      },
      lastName: {
        value:
          fields.ContactNames?.values?.[0]?.properties?.LastName?.content || "",
      },
      nickname: { value: "" }, // Azure doesn't provide this
      position: {
        value: fields.JobTitles?.values?.[0]?.content || "",
      },
      phone: {
        // Try multiple phone sources
        value:
          fields.MobilePhones?.values?.[0]?.content ||
          fields.Phones?.values?.[0]?.content ||
          "",
      },
      email: {
        value: fields.Emails?.values?.[0]?.content || "",
      },
      company: {
        // Fix: CompanyNames (plural, with values array)
        value: fields.CompanyNames?.values?.[0]?.content || "",
      },
      website: {
        value: fields.Websites?.values?.[0]?.content || "",
      },
      notes: { value: "" },
      additionalPhones: [
        ...(fields.MobilePhones?.values?.slice(1).map((p) => ({
          value: p.content || "",
        })) || []),
        ...(fields.OtherPhones?.values?.map((p) => ({
          value: p.content || "",
        })) || []),
      ],
      cardImageUrl: imageUrl,
    };

    console.log("🎯 Final Azure parsed result:", parsed);
    res.json(parsed);
  } catch (err) {
    console.error("❌ Azure OCR error:", err);
    res
      .status(500)
      .json({ message: "OCR processing failed", detail: err.message });
  }
});

module.exports = router;
