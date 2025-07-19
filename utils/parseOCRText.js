// utils/parseOCRText.js
module.exports = function parseOCRText(rawText) {
  const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);

  const emailMatch = rawText.match(/\S+@\S+\.\S+/);
  const phoneMatches = rawText.match(/(\+?\d[\d\s\-().]{7,}\d)/g);
  const websiteMatch = rawText.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
  const nameRegex = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$/;

  let name = "";
  let position = "";
  let company = "";

  for (let line of lines) {
    if (!name && nameRegex.test(line)) {
      name = line;
      continue;
    }

    if (!position && /(Director|Manager|Engineer|Consultant|Founder|CEO|CTO|Developer|Officer|Intern)/i.test(line)) {
      position = line;
      continue;
    }

    if (!company && /(Company|Co\.|Ltd|LLC|Corp|Incorporated|Inc)/i.test(line)) {
      company = line;
    }
  }

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
