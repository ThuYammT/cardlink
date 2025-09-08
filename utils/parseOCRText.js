function parseOCRText(rawText, opts = {}) {
  const options = {
    defaultCountry: opts.defaultCountry || "TH",
    defaultCountryCode: opts.defaultCountryCode || "+66",
    maxPhoneLen: 15,
  };

  console.log("🧠 OCR text:", rawText);

  // ---------- 1) PRE-CLEAN ----------
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
    .map(s => s.trim())
    .filter(Boolean);

  console.log("📄 Split lines:", lines);

  const result = {
    firstName: { value: "", confidence: 0 }, // NER will handle
    lastName: { value: "", confidence: 0 },  // NER will handle
    nickname: { value: "", confidence: 0 },  // NER will handle
    position: { value: "", confidence: 0 },
    phone: { value: "", confidence: 0 },
    additionalPhones: [],
    email: { value: "", confidence: 0 },
    company: { value: "", confidence: 0 },
    website: { value: "", confidence: 0 },
    notes: { value: "", confidence: 0 },
  };

  // ---------- 2) REGEXES ----------
  const emailLike   = /([a-zA-Z0-9._%+\-]+)\s*@\s*([a-zA-Z0-9.\-]+\.[a-z]{2,})/i;
  const emailGlobal = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,})/ig;

  const phoneLine  = /(?:Tel\.?|Phone|Mobile|Mob\.?|Cell|Fax)\s*:?\s*(.+)/i;
  const phoneLoose = /(\+?\d[\d\s\-().]{6,}\d)/g;

  const websiteLoose = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9\-]+(?:\.[a-z0-9\-]+)+(?:\/[^\s]*)?)\b/i;
  const domainLike   = /\b[a-z0-9\-]+\.[a-z]{2,}(?:\.[a-z]{2,})?\b/i;

  const jobTitleWords = [
    "Lecturer","Professor","Manager","Director","Engineer","Consultant","Officer",
    "President","Founder","Intern","Chairperson","Head","Senior","Vice President",
    "Specialist","Analyst","Advisor","Coordinator","Representative","Executive",
    "Assistant","Associate","Chief","CEO","CTO","CFO","COO","Dean","Researcher"
  ];
  const jobTitleRegex = new RegExp(`\\b(${jobTitleWords.join("|")})\\b`, "i");

  const companyWords = [
    "Co\\.?","Ltd\\.?","LLC","Corp\\.?","Inc\\.?","Company",
    "Corporation","Limited","Bank","University","Institute","Faculty","Department",
    "Division","Group","Holdings?","Studio","Agency","Enterprises?","Solutions?",
    "Services?"
  ];
  const companyRegex = new RegExp(`\\b(${companyWords.join("|")})\\b`, "i");

  // ---------- 3) HELPERS ----------
  const seenPhones = new Set();

  function pushPhone(p, confidence = 0.9) {
    const norm = normalizePhone(p, options);
    if (!norm) return;
    if (!result.phone.value) {
      result.phone = { value: norm, confidence };
      seenPhones.add(norm);
      console.log("📞 Main phone:", norm);
    } else if (!seenPhones.has(norm)) {
      result.additionalPhones.push({ value: norm, confidence });
      seenPhones.add(norm);
      console.log("📞 Additional phone:", norm);
    }
  }

  function normalizePhone(p, { defaultCountryCode, maxPhoneLen }) {
    if (!p) return "";
    let s = String(p)
      .replace(/[^\d+]/g, "")
      .replace(/^00/, "+");
    if (!s) return "";
    if (s.startsWith("+")) {
      if (s.length > maxPhoneLen) s = s.slice(0, maxPhoneLen);
      return s;
    }
    if (s.startsWith("0") && s.length >= 9 && s.length <= 11) {
      return (defaultCountryCode + s.slice(1)).slice(0, maxPhoneLen);
    }
    if (s.length >= 8 && s.length <= maxPhoneLen) return s;
    return "";
  }

  // ---------- 4) PROCESS LINES ----------
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log("➡️ Processing line:", line);

    // Email
    if (!result.email.value) {
      const em = line.match(emailGlobal) || (emailLike.test(line) ? [line.replace(emailLike, "$1@$2")] : null);
      if (em && em.length) {
        result.email = { value: em[0].replace(/\s+/g, ""), confidence: 0.95 };
        console.log("✉️ Found email:", result.email.value);
        continue;
      }
    }

    // Phone (labeled) — strip extensions
    const pl = line.match(phoneLine);
    if (pl) {
      let raw = pl[1];
      raw = raw.replace(/\b(?:ext\.?|x)\s*\.?:?\s*\d{1,6}\b/ig, "").trim();
      const phones = raw.match(phoneLoose) || [];
      phones.forEach(p => pushPhone(p, 0.9));
      continue;
    }

    // Phone (loose)
    const phones = line.match(phoneLoose);
    if (phones && phones.length) {
      phones.forEach(p => pushPhone(p, 0.7));
      continue;
    }

    // Website
    if (!result.website.value && websiteLoose.test(line) && !line.includes("@")) {
      const m = line.match(websiteLoose);
      if (m) {
        let url = m[1];
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        result.website = { value: url.toLowerCase(), confidence: 0.9 };
        console.log("🌐 Found website:", result.website.value);
        continue;
      }
    }

    // Position
    if (!result.position.value && jobTitleRegex.test(line)) {
      result.position = { value: line.replace(/\s{2,}/g, " ").trim(), confidence: 0.8 };
      console.log("💼 Found position:", result.position.value);
      continue;
    }

    // Company
    if (!result.company.value && companyRegex.test(line) && !/@/.test(line) && !domainLike.test(line)) {
      result.company = { value: line.replace(/\s{2,}/g, " ").trim(), confidence: 0.7 };
      console.log("🏢 Found company (fallback):", result.company.value);
      continue;
    }
  }

  // ---------- 5) FALLBACKS ----------
  if (!result.company.value && result.email.value.includes("@")) {
    const domain = result.email.value.split("@")[1] || "";
    const root = domain.replace(/^www\./i, "").split(".")[0] || "";
    if (root) {
      result.company = { value: root.replace(/[^a-zA-Z ]/g, ""), confidence: 0.5 };
      console.log("⚠️ Company fallback from email domain:", result.company.value);
    }
  }

  if (!result.website.value && result.email.value.includes("@")) {
    const domain = result.email.value.split("@")[1];
    if (domain) {
      result.website = { value: ("https://" + domain).toLowerCase(), confidence: 0.4 };
      console.log("⚠️ Website fallback from email domain:", result.website.value);
    }
  }

  // ---------- 6) CLEANUP ----------
  const digitsLen = s => (s || "").replace(/\D/g, "").length;
  result.additionalPhones = result.additionalPhones
    .filter(p => p.value && p.value !== result.phone.value && digitsLen(p.value) >= 8)
    .filter((p, i, arr) => arr.findIndex(x => x.value === p.value) === i);

  if (result.phone.value && digitsLen(result.phone.value) < 8) {
    console.log("⚠️ Dropping suspicious short main phone:", result.phone.value);
    result.phone = { value: "", confidence: 0 };
  }

  console.log("🎯 Final parsed result (names left blank for NER):", result);
  return result;
}

module.exports = parseOCRText;
