function parseOCRText(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

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

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
  const phoneRegex = /(?:\+?\d{1,4}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d{3,4}[\s\-]?\d{3,4}/g;
  const websiteRegex = /(https?:\/\/)?(www\.)?([a-zA-Z0-9\-]+\.)+[a-z]{2,}/i;
  const titleKeywords = /(Director|Manager|Chief|CEO|Engineer|Consultant|Officer|Representative|President|Developer|Founder|Intern|Advisor)/i;
  const companyKeywords = /(Co\.|Ltd\.|LLC|Corp|Inc|Company|Corporation|Limited)/i;
  const fullNameRegex = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$|^[A-Z]{2,}(?:\s[A-Z]{2,})+$/;

  let possibleName = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ✅ Extract email
    const emails = line.match(emailRegex);
    if (emails) {
      if (!result.email) result.email = emails[0];
      if (emails.length > 1) {
        result.notes += `Additional emails: ${emails.slice(1).join(", ")}\n`;
      }
      continue;
    }

    // ✅ Extract phone(s)
    const phones = line.match(phoneRegex);
    if (phones) {
      phones.forEach((p) => {
        const cleaned = p.replace(/[^\d+]/g, "");
        if (cleaned.length >= 8 && cleaned.length <= 13) {
          if (!result.phone) result.phone = cleaned;
          else if (!result.additionalPhones.includes(cleaned)) {
            result.additionalPhones.push(cleaned);
          }
        }
      });
      continue;
    }

    // ✅ Extract website (excluding lines with '@')
    if (!result.website && websiteRegex.test(line) && !line.includes("@")) {
      const match = line.match(websiteRegex);
      if (match) {
        result.website = match[0]
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "");
        continue;
      }
    }

    // ✅ Extract job title (top lines prioritized)
    if (i < 5 && !result.position && titleKeywords.test(line)) {
      result.position = line;
      continue;
    }

    // ✅ Extract company
    if (!result.company && companyKeywords.test(line)) {
      result.company = line;
      continue;
    }

    // ✅ Capture potential full name
    if (!result.firstName && fullNameRegex.test(line)) {
      possibleName = line;
      continue;
    }

    // ✅ Fallback: short line, capitalized, no special chars (likely company)
    if (!result.company && /^[A-Z\s&.]{3,30}$/.test(line) && !line.includes("@")) {
      result.company = line;
    }
  }

  // ✅ Parse name if found
  if (possibleName) {
    const parts = possibleName.split(" ");
    result.firstName = parts[0];
    result.lastName = parts.slice(1).join(" ");
  }

  // ✅ Fallback: name from email
  if (!result.firstName && result.email.includes("@")) {
    const [local] = result.email.split("@");
    const [first, last] = local.split(".");
    if (first && last) {
      result.firstName = capitalize(first);
      result.lastName = capitalize(last);
    }
  }

  // ✅ Fallback: company from email domain
  if (!result.company && result.email.includes("@")) {
    const domain = result.email.split("@")[1];
    result.company = capitalizeWords(domain.split(".")[0]);
  }

  // ✅ Fallback: website from email domain
  if (!result.website && result.email.includes("@")) {
    result.website = result.email.split("@")[1];
  }

  return result;
}

// 🔧 Helpers
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function capitalizeWords(text) {
  return text
    .split(/[\s._-]+/)
    .map(capitalize)
    .join(" ");
}

module.exports = parseOCRText;
