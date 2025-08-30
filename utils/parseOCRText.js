// parseOCRText.js (JavaScript version)

function parseOCRText(rawText) {
  const lines = splitCleanLines(rawText);

  const result = {
    firstName: "",
    lastName: "",
    nickname: "",
    position: "",
    phone: "",
    additionalPhones: [],
    email: "",
    company: "",
    website: "",
    notes: "",
    confidence: {},
  };

  // --- Dictionaries & regexes ---
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/g;
  // Allow spaces, dashes, parentheses; start with + or digit; 8–20 chars after stripping
  const phoneCandidate = /(?<![#\w])(\+?\d[\d\s\-().]{6,}\d)(?![#\w])/g;
  const urlRegex =
    /\b(?:(?:https?:\/\/)?(?:www\.)?)[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?\b/g;

  // Titles you’ll likely see on cards (feel free to extend)
  const jobTitles = [
    "chief executive officer",
    "ceo",
    "chief technology officer",
    "cto",
    "chief operating officer",
    "coo",
    "chief marketing officer",
    "cmo",
    "chief product officer",
    "cpo",
    "director",
    "managing director",
    "general manager",
    "manager",
    "assistant manager",
    "lead",
    "head",
    "principal",
    "partner",
    "associate",
    "consultant",
    "engineer",
    "software engineer",
    "developer",
    "designer",
    "officer",
    "specialist",
    "representative",
    "account executive",
    "sales executive",
    "business development",
    "bd",
    "founder",
    "co-founder",
    "president",
    "intern",
    "analyst",
    "researcher",
    "lecturer",
    "professor",
  ];

  // Common company suffixes / keywords
  const companySuffixes = [
    "co.",
    "co",
    "company",
    "ltd.",
    "ltd",
    "llc",
    "corp",
    "inc",
    "limited",
    "public company",
    "plc",
    "partnership",
    "co., ltd.",
  ];

  // Labels that often precede phone; use to boost phone confidence & remove label
  const phoneLabels = ["tel", "mobile", "m.", "m", "cell", "phone", "fax", "t", "p", "hotline"];

  // Ignore lines that look like addresses (kept to notes later)
  const likelyAddressPatterns = /(street|road|rd\.|soi|moo|zip|postcode|suite|floor|fl\.|bldg|building|city|province|state|country|\d{3,}\/\d+)/i;

  // --- Buckets while scanning ---
  const collectedPhones = new Set();
  const leftoverForNotes = [];
  let probableNameLine = "";
  let nameConfidence = 0;
  let positionConfidence = 0;
  let companyConfidence = 0;
  let websiteConfidence = 0;
  let emailConfidence = 0;

  // --- First pass: extract strong-structured fields and mark lines we consume ---
  const consumed = new Array(lines.length).fill(false);

  // 1) Emails
  lines.forEach((line, i) => {
    const matches = line.match(emailRegex);
    if (matches) {
      if (!result.email) {
        result.email = matches[0].toLowerCase();
        emailConfidence = 0.95;
      }
      if (matches.length > 1) {
        appendNote(result, `Additional emails: ${matches.slice(1).join(", ")}`);
      }
      consumed[i] = true;
    }
  });

  // 2) Phones
  lines.forEach((line, i) => {
    const cleanedLabelLine = stripLeadingLabels(line, phoneLabels);
    const matches = cleanedLabelLine.match(phoneCandidate);
    if (matches) {
      for (const raw of matches) {
        const normalized = normalizePhone(raw);
        if (normalized) collectedPhones.add(normalized);
      }
      consumed[i] = true;
    }
  });

  // 3) Websites (avoid lines that include @ to prevent email collision)
  lines.forEach((line, i) => {
    if (line.includes("@")) return;
    const matches = line.match(urlRegex);
    if (matches && !result.website) {
      result.website = cleanWebsite(matches[0]);
      websiteConfidence = 0.8;
      consumed[i] = true;
    }
  });

  // 4) Positions (job titles): prefer exact matches or lines dominated by titles
  lines.forEach((line, i) => {
    if (consumed[i]) return;
    const lc = line.toLowerCase();
    if (jobTitles.some((t) => wordInLine(lc, t))) {
      // keep the shortest reasonable job line (e.g., "Senior Software Engineer")
      if (!result.position || line.length < result.position.length) {
        result.position = squeezeSpaces(line);
        positionConfidence = 0.8;
        consumed[i] = true;
      }
    }
  });

  // 5) Company lines: contain suffixes/keywords, all-caps, or near top/bottom prominence
  lines.forEach((line, i) => {
    if (consumed[i]) return;
    const lc = line.toLowerCase();
    const hasSuffix = companySuffixes.some((s) => wordInLine(lc, s));
    const looksAllCapsWord = line.length <= 40 && isMostlyCaps(line) && !/\d/.test(line);
    if (!result.company && (hasSuffix || looksAllCapsWord)) {
      result.company = tidyCompany(line);
      companyConfidence = hasSuffix ? 0.85 : 0.6;
      consumed[i] = true;
    }
  });

  // 6) Full name guess:
  //    - Prefer 2–4 tokens, each Capitalized or UPPER
  //    - Avoid lines containing titles/labels/domains
  lines.forEach((line, i) => {
    if (consumed[i]) return;
    if (looksLikeFullName(line)) {
      // prefer the one nearest to top third (common on cards)
      if (!probableNameLine) {
        probableNameLine = line;
        nameConfidence = 0.75;
      }
    }
  });

  // --- Assign name if found ---
  if (probableNameLine) {
    const parts = probableNameLine.trim().split(/\s+/);
    const { first, last } = splitName(parts);
    result.firstName = first;
    result.lastName = last;
  }

  // --- Phones: choose primary
  const phones = Array.from(collectedPhones);
  if (phones.length > 0) {
    phones.sort((a, b) => b.length - a.length);
    result.phone = phones[0];
    result.additionalPhones = phones.slice(1);
  }

  // --- Fallbacks from email/domain ---
  if (!result.firstName && result.email.includes("@")) {
    const { first, last } = guessNameFromEmail(result.email);
    result.firstName ||= first;
    result.lastName ||= last;
    if (result.firstName || result.lastName) {
      nameConfidence = Math.max(nameConfidence, 0.55);
    }
  }

  if (!result.company && (result.email || result.website)) {
    const domain = (result.website || result.email.split("@")[1] || "").toLowerCase();
    const base = domain.split("/")[0].replace(/^www\./, "");
    const root = base.split(".")[0];
    if (root && root.length >= 2 && !/\d{3,}/.test(root)) {
      result.company = toTitleWords(root.replace(/[^a-zA-Z]+/g, " "));
      companyConfidence = Math.max(companyConfidence, 0.55);
    }
  }

  if (!result.website && result.email.includes("@")) {
    result.website = result.email.split("@")[1].toLowerCase();
    websiteConfidence = Math.max(websiteConfidence, 0.5);
  }

  // --- Collect leftover useful lines as notes (skip obvious addresses & already-consumed) ---
  lines.forEach((line, i) => {
    if (consumed[i]) return;
    if (likelyAddressPatterns.test(line)) {
      leftoverForNotes.push(line);
      return;
    }
    if (line.length <= 80 && /\w/.test(line)) {
      leftoverForNotes.push(line);
    }
  });

  if (leftoverForNotes.length) {
    appendNote(result, `Other info:\n- ${leftoverForNotes.join("\n- ")}`);
  }

  // --- Confidence export ---
  result.confidence = {
    firstName: result.firstName ? nameConfidence : 0,
    lastName: result.lastName ? nameConfidence : 0,
    position: result.position ? positionConfidence : 0,
    company: result.company ? companyConfidence : 0,
    email: result.email ? emailConfidence : 0,
    website: result.website ? websiteConfidence : 0.0,
    phone: result.phone ? 0.8 : 0.0,
  };

  // Dedupe additionalPhones vs phone
  result.additionalPhones = result.additionalPhones.filter((p) => p !== result.phone);

  return result;
}

// ---------------- helpers ----------------

function splitCleanLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => squeezeSpaces(l.replace(/\s+·\s+/g, " ")).trim())
    .filter((l) => l.length > 0);
}

function squeezeSpaces(s) {
  return s.replace(/\s+/g, " ");
}

function wordInLine(lineLc, needle) {
  const n = needle.toLowerCase();
  return new RegExp(`\\b${escapeRegex(n)}\\b`, "i").test(lineLc);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isMostlyCaps(s) {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const caps = letters.replace(/[a-z]/g, "");
  return caps.length / letters.length >= 0.7;
}

function tidyCompany(s) {
  const cleaned = s.replace(/\s{2,}/g, " ").replace(/\s*[|•\-–—]\s*/g, " ");
  if (isMostlyCaps(cleaned)) return cleaned.toUpperCase();
  return cleaned;
}

function cleanWebsite(url) {
  let u = url.trim();
  u = u.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  u = u.replace(/[),.;:]+$/, "");
  return u;
}

function stripLeadingLabels(line, labels) {
  const lc = line.toLowerCase();
  for (const label of labels) {
    const re = new RegExp(`^\\s*${escapeRegex(label)}\\s*[:]?\\s*`, "i");
    if (re.test(lc)) return line.replace(re, "");
  }
  return line;
}

function normalizePhone(raw) {
  let s = raw.trim();
  s = s.replace(/\b(ext\.?|x)\s*\d{1,5}\b/i, "").trim();
  const hasPlus = s.trim().startsWith("+");
  s = s.replace(/[^\d]/g, "");
  if (hasPlus) s = "+" + s;
  const digitsOnly = s.replace(/\D/g, "");
  if (digitsOnly.length < 8 || digitsOnly.length > 20) return null;
  return s;
}

function looksLikeFullName(line) {
  if (/[,@|/\\]/.test(line)) return false;
  if (/\d/.test(line)) return false;
  const cleaned = line.replace(/\b(mr|ms|mrs|dr|prof)\.?/gi, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;

  let good = 0;
  for (const p of parts) {
    if (/^[A-Z][a-z]+$/.test(p) || /^[A-Z]{2,}$/.test(p)) good++;
  }
  return good >= Math.max(2, parts.length - 1);
}

function splitName(parts) {
  const norm = parts.map((p) => toTitleWord(p));
  const first = norm[0] || "";
  const last = norm.slice(1).join(" ") || "";
  return { first, last };
}

function toTitleWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function toTitleWords(text) {
  return text
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(toTitleWord)
    .join(" ");
}

function guessNameFromEmail(email) {
  const local = email.split("@")[0];
  const byDot = local.split(".");
  const byUnd = local.split("_");
  const parts = byDot.length >= 2 ? byDot : byUnd.length >= 2 ? byUnd : local.match(/[A-Za-z]+/g) || [];
  if (parts.length >= 2) {
    return { first: toTitleWord(parts[0]), last: toTitleWords(parts.slice(1).join(" ")) };
  }
  return { first: toTitleWord(parts[0] || ""), last: "" };
}

function appendNote(res, note) {
  if (!note.trim()) return;
  res.notes += (res.notes ? "\n" : "") + note;
}

module.exports = parseOCRText;
