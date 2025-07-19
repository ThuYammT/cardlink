// utils/parseOCRText.js
module.exports = function parseOCRText(rawText) {
  const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);

  const emailMatch = rawText.match(/\S+@\S+\.\S+/);
  const phoneMatches = rawText.match(/(\+?\d[\d\s\-().]{7,}\d)/g);
  const websiteMatch = rawText.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
  const nameRegex = /^[A-Z][a-zA-Z.'\-]+\s+[A-Z][a-zA-Z.'\-]+$/;

  let name = "";
  let position = "";
  let company = "";

  for (let line of lines) {
    if (!name && nameRegex.test(line)) {
      name = line;
      continue;
    }

    if (!position && /(Director|Manager|Representative|Engineer|Consultant|Founder|CEO|CTO|Developer|Officer|Intern)/i.test(line)) {
      position = line;
      continue;
    }

    if (!company && /(Company|Co\.|Ltd|LLC|Corp|Incorporated|Inc)/i.test(line)) {
      company = line;
    }
  }

  if (!name && lines.length > 0) {
    // Fallback to 1st line if it's not email or position
    const fallback = lines.find(l => !l.includes("@") && !l.match(/\d+/));
    if (fallback) name = fallback;
  }

  if (!company && emailMatch) {
    const domain = emailMatch[0].split("@")[1].split(".")[0];
    company = domain.charAt(0).toUpperCase() + domain.slice(1);
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
