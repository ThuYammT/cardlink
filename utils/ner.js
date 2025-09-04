const NER_URL = process.env.NER_URL || "https://cardlink-ner.onrender.com/ner";

async function runSpaCyNER(text) {
  try {
    const response = await fetch(NER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error("❌ NER service error:", await response.text());
      return [];
    }

    const data = await response.json();
    return data.entities || [];
  } catch (err) {
    console.error("❌ Failed to call NER service:", err.message);
    return [];
  }
}

module.exports = runSpaCyNER;
