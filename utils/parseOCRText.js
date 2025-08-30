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

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,})/g; // Email extraction regex
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/g;
  const websiteRegex = /(https?:\/\/)?(www\.)?([a-zA-Z0-9\-]+\.)+[a-z]{2,}/i;
  const jobTitleRegex = /(Lecturer|Manager|Director|Engineer|Consultant|Officer|President|Founder|Intern|Chairperson)/i; // Job titles regex
  const companyRegex = /(Co\.|Ltd\.|LLC|Corp|Inc|Company|Corporation|Limited)/i;

  // Full Name Regex (handles title before or after the name)
  const fullNameRegex = /^(Dr\.|Prof\.|Ph\.D\.|M\.S\.)?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)(\s*(,?\s*(Dr\.|Ph\.D\.|M\.S\.|Prof\.))?)$/;

  let possibleNameLine = "";

  // Helper function to clean lines from unwanted characters
  function cleanLine(line) {
    return line.replace(/[|=]/g, "").trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log("Processing line:", line);

    // ✅ Extract emails
    const emails = line.match(emailRegex);
    if (emails && emails.length > 0) {
      result.email = emails[0];
      console.log("Found email:", result.email);
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
      console.log("Found phone:", result.phone);
      continue;
    }

    // ✅ Extract website
    if (!result.website && websiteRegex.test(line) && !line.includes("@")) {
      result.website = line
        .match(websiteRegex)[0]
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "");
      console.log("Found website:", result.website);
      continue;
    }

    // ✅ Extract job position (full-time lecturer, etc.)
    if (!result.position && jobTitleRegex.test(line)) {
      result.position = cleanLine(line);  // Clean extra symbols like "|"
      console.log("Found position:", result.position);
      continue;
    }

    // ✅ Extract company
    if (!result.company && companyRegex.test(line)) {
      result.company = cleanLine(line);  // Clean extra symbols
      console.log("Found company:", result.company);
      continue;
    }

    // ✅ Try matching a full name line with title
    if (!result.firstName && fullNameRegex.test(line)) {
      possibleNameLine = line;
      console.log("Possible name line:", possibleNameLine);
      continue;
    }
  }

  // ✅ Use matched full name
  if (possibleNameLine) {
    const nameMatch = possibleNameLine.match(fullNameRegex);
    if (nameMatch && nameMatch[2]) {
      result.firstName = nameMatch[2].split(" ")[0];
      result.lastName = nameMatch[2].split(" ").slice(1).join(" ");
      console.log("Extracted first name:", result.firstName);
      console.log("Extracted last name:", result.lastName);
    }
  }

  // ✅ Fallback name from email local part
  if (!result.firstName && result.email.includes("@")) {
    const [local] = result.email.split("@");
    const [first, last] = local.split(".");
    if (first && last) {
      result.firstName = capitalize(first);
      result.lastName = capitalize(last);
    }
    console.log("Fallback name from email - First Name:", result.firstName);
    console.log("Fallback name from email - Last Name:", result.lastName);
  }

  // ✅ Fallback company from domain
  if (!result.company && result.email.includes("@")) {
    const domain = result.email.split("@")[1];
    const name = domain.split(".")[0];
    result.company = capitalizeWords(name.replace(/[^a-zA-Z ]/g, ""));
    console.log("Fallback company from email domain:", result.company);
  }

  // ✅ Fallback website from email domain
  if (!result.website && result.email.includes("@")) {
    result.website = result.email.split("@")[1];
    console.log("Fallback website from email domain:", result.website);
  }

  // Log the final result
  console.log("Final parsed result:", result);

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
