// parseOCRText.js
function parseOCRText(rawText, opts = {}) {
  const options = {
    defaultCountry: opts.defaultCountry || "TH",
    defaultCountryCode: opts.defaultCountryCode || "+66",
    maxPhoneLen: 15,
  };

  // ---------- 1) PRE-CLEAN ----------
  const text = (rawText || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")       // zero-width
    .replace(/[|=]+/g, " ")                      // pipes, equals
    .replace(/@\s+/g, "@")                       // "name@ domain" → "name@domain"
    .replace(/\s+\.\s+/g, ".")                   // "domain . com" → "domain.com"
    .replace(/https?:\s*\/\s*\//gi, "https://")  // "http: //"
    .replace(/\( ?0 ?\)/g, "")                   // remove (0) in +66(0)
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/_+\s*co\.th/gi, ".co.th");         // "lhbank_ co.th" → "lhbank.co.th"

  const lines = text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

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
  };

  // ---------- 2) REGEXES ----------
  const emailLike   = /([a-zA-Z0-9._%+\-]+)\s*@\s*([a-zA-Z0-9.\-]+\.[a-z]{2,})/i; // tolerant
  const emailGlobal = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,})/ig;         // strict

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
    "Co\\.?","Co\\.,?\\s*Ltd\\.?","Ltd\\.?","LLC","Corp\\.?","Inc\\.?","Company",
    "Corporation","Limited","Bank","University","Institute","Faculty","Department",
    "Division","Group","Holdings?","Studio","Agency","Enterprises?","Solutions?",
    "Services?"
  ];
  const companyRegex = new RegExp(`\\b(${companyWords.join("|")})\\b`, "i");

  const honorifics = ["Dr\\.","Prof\\.","Mr\\.","Mrs\\.","Ms\\.","Miss","M\\.S\\.","Ph\\.D\\."];
  const nameLineRegex = new RegExp(
    `^(?:${honorifics.join("|")})?\\s*([A-Z][a-zA-Z'\\-]+(?:\\s+[A-Z][a-zA-Z'\\-]+){0,3})(?:\\s*\\(([^)]+)\\)|\\s*["“]([^"”]+)["”])?\\s*$`
  );

  // ---------- 3) HELPERS ----------
  const seenPhones = new Set();

  function pushPhone(p) {
    const norm = normalizePhone(p, options);
    if (!norm) return;
    if (!result.phone) {
      result.phone = norm;
      seenPhones.add(norm);
    } else if (!seenPhones.has(norm)) {
      result.additionalPhones.push(norm);
      seenPhones.add(norm);
    }
  }

  function normalizePhone(p, { defaultCountryCode, maxPhoneLen }) {
    if (!p) return "";
    let s = String(p)
      .replace(/[^\d+]/g, "")   // keep digits and +
      .replace(/^00/, "+");     // 00 → +
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

  const cap = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "";
  const capWords = (txt) => (txt || "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(cap)
    .join(" ");

  function looksLikeCompany(line) {
    if (companyRegex.test(line)) return true;
    const tokens = line.replace(/[^\w\s&.,-]/g, "").trim();
    const manyCaps = /[A-Z]{2,}/.test(tokens) && tokens.length > 6;
    const orgHints = /\b(Bank|University|Dept\.?|Department|Division|Institute|College|School|Hospital|Chamber)\b/i.test(tokens);
    return manyCaps || orgHints;
  }

  function cleanUrl(u) {
    try {
      let url = u;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      const { hostname } = new URL(url);
      return hostname.replace(/^www\./, "");
    } catch {
      return u.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    }
  }

  const noiseForName = /(tel|mobile|fax|e-?mail|email|www|http|ext|bank|division|department|faculty|university)/i;
  function isNameCandidate(s) {
    const line = s.replace(/^[^\w]+|[^\w]+$/g, ""); // trim punctuation
    if (noiseForName.test(line)) return false;
    if (/\d/.test(line)) return false;
    const tokens = line.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 4) return false;
    const caps = tokens.filter(t => /^[A-Z][a-zA-Z'’-]+$/.test(t)).length;
    return caps >= 2;
  }

  // ---------- 4) PASS 1: gather candidates ----------
  let bestName = { line: "", idx: -1, nickname: "" };
  let bestNameScore = -1;
  let titleIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Emails (first sensible one)
    if (!result.email) {
      const em = line.match(emailGlobal) || (emailLike.test(line) ? [line.replace(emailLike, "$1@$2")] : null);
      if (em && em.length) {
        result.email = em[0].replace(/\s+/g, "");
        continue;
      }
    }

    // Phones from labeled lines
    const pl = line.match(phoneLine);
    if (pl) {
      const raw = pl[1];
      const phones = raw.match(phoneLoose) || [];
      phones.forEach(pushPhone);
      // extension
      const ext = raw.match(/\b(?:ext\.?|x)\s*\.?:?\s*(\d{1,6})\b/i);
      if (ext && result.phone) result.phone = `${result.phone};ext=${ext[1]}`;
      continue;
    }

    // Phones from unlabeled lines
    const phones = line.match(phoneLoose);
    if (phones && phones.length) {
      phones.forEach(pushPhone);
      continue;
    }

    // Website
    if (!result.website && websiteLoose.test(line) && !line.includes("@")) {
      const m = line.match(websiteLoose);
      if (m) {
        result.website = cleanUrl(m[1]);
        continue;
      }
    }

    // Position / title
    if (!result.position && jobTitleRegex.test(line)) {
      if (!looksLikeCompany(line)) {
        // keep substring starting from first title keyword
        const m = line.match(/(Head|Senior|Vice\s*President|Manager|Director|Lecturer|Professor|Chief|Officer|Consultant|Executive|Representative).*$/i);
        result.position = (m ? m[0] : line).replace(/\s{2,}/g, " ").trim();
        titleIndex = i;
        continue;
      }
    }

    // Company (avoid obvious emails/domains)
    if (!result.company && looksLikeCompany(line) && !/@/.test(line) && !domainLike.test(line)) {
      result.company = line.replace(/\s{2,}/g, " ").trim();
      continue;
    }

    // Name candidates (clean lines like ". Warren Lee")
    const cleanedStart = line.replace(/^[^\w]+/, "");
    const nm = cleanedStart.match(nameLineRegex);
    if (nm) {
      const candidate = nm[1];
      const nick = nm[2] || nm[3] || "";
      const sc = scoreNameLine(candidate, i);
      if (sc > bestNameScore) {
        bestNameScore = sc;
        bestName = { line: candidate, idx: i, nickname: nick };
      }
      continue;
    }
  }

  // ---------- helper used above ----------
  function scoreNameLine(line, idx) {
    let score = 0;
    if (idx <= 2) score += 3;
    if (/^[A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){0,2}$/.test(line)) score += 3;
    if (jobTitleRegex.test(lines[idx + 1] || "")) score += 2;
    if (!companyRegex.test(line) && !websiteLoose.test(line) && !emailGlobal.test(line)) score += 1;
    return score;
  }

  // ---------- 5) SET NAME (prefer around title) ----------
  if (!bestName.line) {
    // try lines around the title
    const around = [];
    if (titleIndex > 0) around.push(titleIndex - 1);
    if (titleIndex > 1) around.push(titleIndex - 2);
    if (titleIndex >= 0 && titleIndex + 1 < lines.length) around.push(titleIndex + 1);

    let chosen = "";
    for (const idx of around) {
      const ln = (lines[idx] || "").replace(/^[^\w]+/, "");
      if (isNameCandidate(ln)) { chosen = ln; break; }
    }
    // fallback: first few lines
    if (!chosen) {
      for (let k = 0; k < Math.min(4, lines.length); k++) {
        const ln = lines[k].replace(/^[^\w]+/, "");
        if (isNameCandidate(ln)) { chosen = ln; break; }
      }
    }
    if (chosen) bestName.line = chosen;
  }

  if (bestName.line) {
    const parts = bestName.line.trim().split(/\s+/);
    if (parts.length >= 1) result.firstName = parts[0];
    if (parts.length >= 2) result.lastName  = parts.slice(1).join(" ");
    if (bestName.nickname) {
      result.nickname = bestName.nickname.replace(/^["“']|["”']$/g, "").trim();
    }
  }

  // ---------- 6) FALLBACKS ----------
  if (!result.firstName && result.email.includes("@")) {
    const [local] = result.email.split("@");
    const segs = local.split(/[._-]+/).filter(Boolean);
    if (segs.length >= 2) {
      result.firstName = cap(segs[0]);
      result.lastName  = capWords(segs.slice(1).join(" "));
    } else if (segs.length === 1) {
      result.firstName = cap(segs[0]);
    }
  }

  if (!result.company && result.email.includes("@")) {
    const domain = result.email.split("@")[1] || "";
    const root = domain.replace(/^www\./i, "").split(".")[0] || "";
    if (root) result.company = capWords(root.replace(/[^a-zA-Z ]/g, ""));
  }

  if (!result.website && result.email.includes("@")) {
    result.website = result.email.split("@")[1];
  }

  // ---------- 7) FINAL TOUCHES ----------
  result.additionalPhones = result.additionalPhones
    .filter(p => p && p !== result.phone)
    .filter((p, i, arr) => arr.indexOf(p) === i);

  if (result.firstName) result.firstName = capWords(result.firstName);
  if (result.lastName)  result.lastName  = capWords(result.lastName);
  if (result.company)   result.company   = result.company.replace(/\s{2,}/g, " ").trim();

  return result;
}

module.exports = parseOCRText;
