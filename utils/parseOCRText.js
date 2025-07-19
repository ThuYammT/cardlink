// utils/parseOCRText.js
module.exports = function parseOCRText(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 1);

  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/g;
  const websiteRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
  const nameRegex = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}$/; // e.g., John Doe
  const positionKeywords = /(director|manager|ceo|cto|founder|consultant|engineer|developer|representative|officer|intern)/i;
  const companyKeywords = /(co\.|company|limited|ltd|llc|corp|inc|incorporated|plc|co\,? ltd\.?|group|studio|chamber|organization|agency|services)/i;

  let email = "";
  let phones = [];
  let website = "";
  let name = "";
  let position = "";
  let company = "";

  // === Step 1: Extract basic info
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!email && emailRegex.test(line)) {
      email = line.match(emailRegex)?.[0] || "";
    }

    if (phoneRegex.test(line)) {
      phones.push(...(line.match(phoneRegex) || []));
    }

    if (!website && websiteRegex.test(line)) {
      website = line.match(websiteRegex)?.[0] || "";
    }

    if (!position && positionKeywords.test(line)) {
      position = line;
      // Try previous line as name
      if (!name && i > 0 && nameRegex.test(lines[i - 1])) {
        name = lines[i - 1];
      }
    }

    if (!company && companyKeywords.test(line)) {
      company = line;
    }

    // Name fallback
    if (!name && nameRegex.test(line)) {
      name = line;
    }
  }

  // === Step 2: Process name
  const nameParts = name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  return {
    firstName,
    lastName,
    nickname: "", // not parsed unless clearly labeled
    position,
    company,
    phone: phones[0] || "",
    additionalPhones: phones.slice(1),
    email,
    website,
    notes: rawText,
  };
};
