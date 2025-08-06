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

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/gi;
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/g;
  const websiteRegex = /((https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-z]{2,})/gi;
  const companyKeywords = /(Co\.|Company|Corporation|Ltd|LLC|Inc|Group|Chamber|Studio|Association)/i;
  const positionKeywords = /(Chief|Director|Manager|CEO|CTO|Engineer|Advisor|Consultant|Officer|Representative|President|Developer|Intern)/i;

  // Collect all emails
  const emails = [...text.matchAll(emailRegex)].map(match => match[0]);
  if (emails.length > 0) {
    result.email = emails[0];
    if (emails.length > 1) {
      result.notes += "\nAdditional emails: " + emails.slice(1).join(", ");
    }
  }

  // Collect all phone numbers
  const phones = [...text.matchAll(phoneRegex)].map(match => match[0].replace(/[^\d+]/g, ''));
  if (phones.length > 0) {
    result.phone = phones[0];
    result.additionalPhones = phones.slice(1);
  }

  // Website
  const websites = [...text.matchAll(websiteRegex)].map(match => match[0].replace(/^https?:\/\//, "").replace(/^www\./, ""));
  if (websites.length > 0) result.website = websites[0];

  // Position detection
  const positionLine = lines.find(line => positionKeywords.test(line));
  if (positionLine) result.position = positionLine;

  // Company detection
  const companyLine = lines.find(line => companyKeywords.test(line));
  if (companyLine) result.company = companyLine;

  // Name detection (heuristic: full name capitalized or appears before position/email)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      /^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test(line) ||             // e.g. John Doe
      /^[A-Z\s]{5,30}$/.test(line) ||                           // e.g. KALANYOO AMMARANON
      (/^[A-Z][a-z]+$/.test(line) && /^[A-Z][a-z]+$/.test(lines[i + 1] || ""))
    ) {
      const nameLine = /^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test(line)
        ? line
        : line + " " + (lines[i + 1] || "");

      const words = nameLine.split(" ");
      result.firstName = words[0];
      result.lastName = words.slice(1).join(" ");
      break;
    }
  }

  // Fallback: infer name from email
  if (!result.firstName && result.email.includes("@")) {
    const parts = result.email.split("@")[0].split(/[._]/);
    if (parts.length >= 2) {
      result.firstName = capitalize(parts[0]);
      result.lastName = capitalize(parts.slice(1).join(" "));
    }
  }

  // Fallback: company from email domain
  if (!result.company && result.email.includes("@")) {
    const domain = result.email.split("@")[1].split(".")[0];
    result.company = capitalizeWords(domain.replace(/[^a-zA-Z]/g, ""));
  }

  result.notes = result.notes.trim();
  return result;
}

// Helpers
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
