function parseOCRText(rawText, opts = {}) {
  const options = {
    defaultCountry: opts.defaultCountry || "TH",
    defaultCountryCode: opts.defaultCountryCode || "+66",
    maxPhoneLen: 15,
  };

  console.log("🧠 OCR text:", rawText);

  const text = (rawText || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[|=]+/g, " ")
    .replace(/@\s+/g, "@")
    .replace(/\s+\.\s+/g, ".")
    .replace(/https?:\s*\/\s*\//gi, "https://")
    .replace(/\( ?0 ?\)/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/_+\s*co\.th/gi, ".co.th");

  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  console.log("📄 Split lines:", lines);

  // Fallback structure (names will be filled by Google NLP)
  const result = {
    firstName: { value: "", confidence: 0 },
    lastName: { value: "", confidence: 0 },
    fullName: { value: "", confidence: 0 },
    nickname: { value: "", confidence: 0 },
    position: { value: "", confidence: 0 },
    phone: { value: "", confidence: 0 },
    additionalPhones: [],
    email: { value: "", confidence: 0 },
    company: { value: "", confidence: 0 },
    website: { value: "", confidence: 0 },
    notes: { value: "", confidence: 0 },
  };

  const emailRegex = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,})/gi;
  const phoneRegex = /(\+?\d[\d\s\-().]{6,}\d)/g;
  const websiteRegex = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9\-]+(?:\.[a-z0-9\-]+)+(?:\/[^\s]*)?)\b/i;

  const jobTitleWords = [
    "Lecturer","Professor","Manager","Director","Engineer","Consultant","Officer",
    "President","Founder","Intern","Chairperson","Head","Senior","Vice President",
    "Specialist","Analyst","Advisor","Coordinator","Representative","Executive",
    "Assistant","Associate","Chief","CEO","CTO","CFO","COO","Dean","Researcher"
  ];
  const jobTitleRegex = new RegExp(`\\b(${jobTitleWords.join("|")})\\b`, "i");

  const seenPhones = new Set();

  function normalizePhone(p) {
    if (!p) return "";
    let s = String(p).replace(/[^\d+]/g, "").replace(/^00/, "+");
    if (!s) return "";
    if (s.startsWith("+")) {
      return s.slice(0, options.maxPhoneLen);
    }
    if (s.startsWith("0") && s.length >= 9 && s.length <= 11) {
      return (options.defaultCountryCode + s.slice(1)).slice(0, options.maxPhoneLen);
    }
    if (s.length >= 8 && s.length <= options.maxPhoneLen) return s;
    return "";
  }

  function pushPhone(p, confidence = 0.7) {
    const norm = normalizePhone(p);
    if (!norm) return;
    if (!result.phone.value) {
      result.phone = { value: norm, confidence };
      seenPhones.add(norm);
      console.log("📞 Main phone (fallback):", norm);
    } else if (!seenPhones.has(norm)) {
      result.additionalPhones.push({ value: norm, confidence });
      seenPhones.add(norm);
      console.log("📞 Additional phone (fallback):", norm);
    }
  }

  // Process lines for fallback only
  for (const line of lines) {
    console.log("➡️ Processing line (fallback):", line);

    // Email
    if (!result.email.value) {
      const match = line.match(emailRegex);
      if (match) {
        result.email = { value: match[0].replace(/\s+/g, ""), confidence: 0.9 };
        console.log("✉️ Found email (fallback):", result.email.value);
        continue;
      }
    }

    // Phones
    const phones = line.match(phoneRegex);
    if (phones) {
      phones.forEach((p) => pushPhone(p));
      continue;
    }

    // Website
    if (!result.website.value && websiteRegex.test(line) && !line.includes("@")) {
      let url = line.match(websiteRegex)[1];
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      result.website = { value: url.toLowerCase(), confidence: 0.8 };
      console.log("🌐 Found website (fallback):", result.website.value);
      continue;
    }

    // Position
    if (!result.position.value && jobTitleRegex.test(line)) {
      result.position = { value: line.trim(), confidence: 0.7 };
      console.log("💼 Found position (fallback):", result.position.value);
      continue;
    }
  }

  console.log("🎯 Final fallback parsed result:", result);
  return result;
}

module.exports = parseOCRText;
