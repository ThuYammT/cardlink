// parseOCRText.js
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
    .replace(/_+\s*co\.th/gi, ".co.th")
    .replace(/\.auedu\b/gi, ".au.edu")      // fix OCR
    .replace(/^\s*[:•\-–]+/gm, "");         // strip leading junk

  const lines = text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  console.log("📄 Split lines:", lines);

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
    "Co\\.?","Co\\.,?\\s*Ltd\\.?","Ltd\\.?","LLC","Corp\\.?","Inc\\.?","Company",
    "Corporation","Limited","Bank","University","Institute","Faculty","Department",
    "Division","Group","Holdings?","Studio","Agency","Enterprises?","Solutions?",
    "Services?","Chamber"
  ];
  const companyRegex = new RegExp(`\\b(${companyWords.join("|")})\\b`, "i");

  const honorifics = ["Dr\\.","Prof\\.","Mr\\.","Mrs\\.","Ms\\.","Miss","M\\.S\\.","Ph\\.D\\."];
  const nameLineRegex = new RegExp(
    `^(?:${honorifics.join("|")})?\\s*([A-Z][a-zA-Z'\\-]+(?:\\s+[A-Z][a-zA-Z'\\-]+){0,3})(?:\\s*\\(([^)]+)\\)|\\s*["“]([^"”]+)["”])?\\s*$`
  );
  const nameWithDegree = /^([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){1,3})\s*(?:,\s*(?:Ph\.?D\.?|M\.?Sc\.?|B\.?Sc\.?|MBA|MEng|BEng|DPhil|EdD)\b.*)?$/;

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
    console.log("📞 Found phone:", norm);
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

  const cap = (w) => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "";
  const capWords = (txt) => (txt || "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(cap)
    .join(" ");

  const noiseForName = /(tel|mobile|fax|e-?mail|email|www|http|ext|bank|division|department|faculty|university)/i;
  function isNameCandidate(s) {
    const line = s.replace(/^[^\w]+|[^\w]+$/g, "");
    if (noiseForName.test(line)) return false;
    if (/\d/.test(line)) return false;
    const tokens = line.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 4) return false;
    const caps = tokens.filter(t => /^[A-Z][a-zA-Z'’-]+$/.test(t)).length;
    return caps >= 2;
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

  function isDeptOrFaculty(s) {
    return /^\s*(Department|Faculty)\b/i.test(s);
  }
  function companyScore(s) {
    let score = 0;
    if (/\b(University|Bank|Co\.|Ltd\.|Inc\.|Corp\.|LLC|Company|Corporation|Chamber)\b/i.test(s)) score += 3;
    if (!isDeptOrFaculty(s)) score += 1;
    if (/[A-Z]{2,}/.test(s)) score += 1;
    return score;
  }

  // ---------- 4) PROCESS LINES ----------
  let bestName = { line: "", idx: -1, nickname: "" };
  let bestNameScore = -1;
  let titleIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log("➡️ Processing line:", line);

    // Email
    if (!result.email) {
      const em = line.match(emailGlobal) || (emailLike.test(line) ? [line.replace(emailLike, "$1@$2")] : null);
      if (em && em.length) {
        result.email = em[0].replace(/\s+/g, "");
        console.log("✉️ Found email:", result.email);
        continue;
      }
    }

    // Phone (labeled, skip fax)
    const pl = line.match(phoneLine);
    if (pl) {
      const isFax = /Fax/i.test(line);
      const raw = pl[1];
      if (!isFax) {
        const phones = raw.match(phoneLoose) || [];
        phones.forEach(pushPhone);
      }
      const ext = raw.match(/\b(?:ext\.?|x)\s*\.?:?\s*(\d{1,6})\b/i);
      if (ext && result.phone) {
        result.phone = `${result.phone};ext=${ext[1]}`;
        console.log("📌 Added extension:", ext[1]);
      }
      continue;
    }

    // Phone (loose)
    const phones = line.match(phoneLoose);
    if (phones && phones.length) {
      phones.forEach(pushPhone);
      continue;
    }

    // Website
    if (websiteLoose.test(line) && !line.includes("@")) {
      const m = line.match(websiteLoose);
      if (m) {
        const host = cleanUrl(m[1]);
        if (!result.website || host.split(".").length > result.website.split(".").length) {
          result.website = host;
        }
        console.log("🌐 Found website:", result.website);
        continue;
      }
    }

    // Position
    if (!result.position && jobTitleRegex.test(line)) {
      result.position = line.replace(/\s{2,}/g, " ").trim();
      // clean OCR garbage
      result.position = result.position
        .replace(/^[^A-Za-z]+/, "")
        .replace(/[^A-Za-z, \-–&]/g, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/\b(ft|sia)\b$/i, "")
        .trim();
      titleIndex = i;
      console.log("💼 Found position:", result.position);
      continue;
    }

    // Company
    if (!/@/.test(line) && !domainLike.test(line) && looksLikeCompany(line) && !isDeptOrFaculty(line)) {
      if (!result.company || companyScore(line) >= companyScore(result.company)) {
        result.company = line.replace(/\s{2,}/g, " ").trim();
        console.log("🏢 Found/updated company:", result.company);
      }
      continue;
    }

    // Name
    const cleanedStart = line.replace(/^[^\w]+/, "").replace(/\s+0\b$/, "");
    const nm = cleanedStart.match(nameLineRegex);
    if (nm) {
      const candidate = nm[1];
      const nick = nm[2] || nm[3] || "";
      bestName = { line: candidate, idx: i, nickname: nick };
      bestNameScore = 999;
      console.log("👤 Name candidate:", candidate);
      continue;
    }
    const md = cleanedStart.match(nameWithDegree);
    if (md) {
      const candidate = md[1];
      bestName = { line: candidate, idx: i, nickname: "" };
      bestNameScore = 999;
      console.log("👤 Name via degree pattern:", candidate);
      continue;
    }
  }

  // ---------- 5) FINAL NAME ----------
  if (bestName.line) {
    const parts = bestName.line.trim().split(/\s+/);
    result.firstName = parts[0];
    result.lastName  = parts.slice(1).join(" ");
    if (bestName.nickname) result.nickname = bestName.nickname;
    console.log("✅ Chosen name:", result.firstName, result.lastName);
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
    console.log("🔄 Fallback name from email:", result.firstName, result.lastName);
  }

  if (!result.company && result.email.includes("@")) {
    const domain = result.email.split("@")[1] || "";
    const root = domain.replace(/^www\./i, "").split(".")[0] || "";
    if (root) result.company = capWords(root.replace(/[^a-zA-Z ]/g, ""));
    console.log("🔄 Fallback company:", result.company);
  }

  if (!result.website && result.email.includes("@")) {
    result.website = result.email.split("@")[1];
    console.log("🔄 Fallback website:", result.website);
  }

  // ---------- 7) CLEANUP ----------
  result.additionalPhones = result.additionalPhones
    .filter(p => p && p !== result.phone)
    .filter((p, i, arr) => arr.indexOf(p) === i);

  if (result.firstName) result.firstName = capWords(result.firstName);
  if (result.lastName)  result.lastName  = capWords(result.lastName);
  if (result.company)   result.company   = result.company.replace(/\s{2,}/g, " ").trim();

  console.log("🎯 Final parsed result:", result);
  return result;
}

module.exports = parseOCRText;
