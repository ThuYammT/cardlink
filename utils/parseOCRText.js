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
    notes: "", // Leave blank for now, can store extra info
  };

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/g;
  const websiteRegex = /(https?:\/\/)?(www\.)?([a-zA-Z0-9\-]+\.)+[a-z]{2,}/i;
  const jobTitleRegex = /(Director|Manager|Chief|CEO|Engineer|Consultant|Officer|Representative|President|Developer|Founder|Intern)/i;
  const companyRegex = /(Co\.|Ltd\.|LLC|Corp|Inc|Company|Corporation|Limited)/i;
  const fullNameRegex = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$/;

  let possibleNameLine = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ✅ Extract emails
    const emails = line.match(emailRegex);
    if (emails && emails.length > 0) {
      if (!result.email) result.email = emails[0];
      if (emails.length > 1) {
        result.notes += `Additional emails: ${emails.slice(1).join(", ")}\n`;
      }
      continue;
    }

    // ✅ Extract phone numbers
    const phones = line.match(phoneRegex);
    if (phones && phones.length > 0) {
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

    // ✅ Extract website (but avoid lines with '@')
    if (!result.website && websiteRegex.test(line) && !line.includes("@")) {
      result.website = line
        .match(websiteRegex)[0]
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "");
      continue;
    }

    // ✅ Extract job position
    if (!result.position && jobTitleRegex.test(line)) {
      result.position = line;
      continue;
    }

    // ✅ Extract company
    if (!result.company && companyRegex.test(line)) {
      result.company = line;
      continue;
    }

    // ✅ Try matching a full name line
    if (!result.firstName && fullNameRegex.test(line)) {
      possibleNameLine = line;
      continue;
    }
  }

  // ✅ Use matched full name
  if (possibleNameLine) {
    const nameParts = possibleNameLine.split(" ");
    result.firstName = nameParts[0];
    result.lastName = nameParts.slice(1).join(" ");
  }

  // ✅ Fallback name from email local part
  if (!result.firstName && result.email.includes("@")) {
    const [local] = result.email.split("@");
    const [first, last] = local.split(".");
    if (first && last) {
      result.firstName = capitalize(first);
      result.lastName = capitalize(last);
    }
  }

  // ✅ Fallback company from domain
  if (!result.company && result.email.includes("@")) {
    const domain = result.email.split("@")[1];
    const name = domain.split(".")[0];
    result.company = capitalizeWords(name.replace(/[^a-zA-Z ]/g, ""));
  }

  // ✅ Fallback website from email domain
  if (!result.website && result.email.includes("@")) {
    result.website = result.email.split("@")[1];
  }

  return result;
}

// 🛠️ Helpers
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
