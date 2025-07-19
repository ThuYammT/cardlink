// utils/parseOCRText.js
module.exports = function parseOCRText(rawText) {
  const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);

  // Email
  const emailMatch = rawText.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);

  // Phone: supports international, spaces, dashes
  const phoneMatches = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}/g);

  // Website
  const websiteMatch = rawText.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?\b/gi);

  // Company: look for lines with "Co.", "Ltd", "Inc", "Company", or all-uppercase
  let company = lines.find((line) =>
    /(Co\.|Ltd|Inc|LLC|Company|Incorporated)/i.test(line) ||
    /^[A-Z\s]{4,}$/.test(line)
  ) || "";

  // Position: common job titles
  const positionTitles = /(CEO|CTO|COO|Manager|Director|Consultant|Engineer|Developer|Intern|Founder|Representative|Officer)/i;
  const position = lines.find((line) => positionTitles.test(line)) || "";

  // Name: heuristic — exclude lines with email, phone, company, or position
  const name = lines.find((line) =>
    !emailMatch?.[0]?.includes(line) &&
    !position.includes(line) &&
    !company.includes(line) &&
    !line.match(/@|http|www|\d{2,}/) &&  // no URLs or numbers
    /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$/.test(line)  // format: First Last
  ) || "";

  const nameParts = name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  return {
    firstName,
    lastName,
    nickname: "",
    phone: phoneMatches?.[0] || "",
    additionalPhones: phoneMatches?.slice(1) || [],
    email: emailMatch?.[0] || "",
    position,
    company,
    website: websiteMatch?.[0] || "",
    notes: rawText,
  };
};
