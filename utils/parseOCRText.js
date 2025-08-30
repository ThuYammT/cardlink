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
    confidence: {},
  };

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/g;
  const websiteRegex = /(https?:\/\/)?(www\.)?([a-zA-Z0-9\-]+\.)+[a-z]{2,}/i;
  const jobTitleRegex = /(Director|Manager|Chief|CEO|Engineer|Consultant|Officer|Representative|President|Developer|Founder|Intern)/i;
  const companyRegex = /(Co\.|Ltd\.|LLC|Corp|Inc|Company|Corporation|Limited)/i;
  const fullNameRegex = /([A-Z][a-z]+(?: [A-Z][a-z]+)+|\b[A-Za-z]+ [A-Za-z]+\b)/;

  let possibleNameLine = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Log each line for debugging
    console.log("Processing line:", line);

    // Extract emails
    const emails = line.match(emailRegex);
    if (emails && emails.length > 0) {
      result.email = emails[0];
      result.confidence.email = 0.9;
      console.log("Found email:", result.email);
      continue;
    }

    // Extract phone numbers
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
      result.confidence.phone = 0.8;
      console.log("Found phone:", result.phone);
      continue;
    }

    // Extract job title
    if (!result.position && jobTitleRegex.test(line)) {
      result.position = line;
      result.confidence.position = 0.7;
      console.log("Found position:", result.position);
      continue;
    }

    // Extract company
    if (!result.company && companyRegex.test(line)) {
      result.company = line;
      result.confidence.company = 0.8;
      console.log("Found company:", result.company);
      continue;
    }

    // Try to match full name
    if (!result.firstName && fullNameRegex.test(line)) {
      possibleNameLine = line;
      console.log("Possible name line:", possibleNameLine);
      continue;
    }
  }

  // Use matched full name
  if (possibleNameLine) {
    const nameParts = possibleNameLine.split(" ");
    console.log("Name parts:", nameParts);

    if (nameParts.length >= 2) {
      result.firstName = nameParts[0];
      result.lastName = nameParts.slice(1).join(" ");
    } else {
      result.firstName = nameParts[0];
    }

    console.log("Extracted first name:", result.firstName);
    console.log("Extracted last name:", result.lastName);
  }

  // Fallback logic for name
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

  // Log the final result
  console.log("Final parsed result:", result);

  return result;
}

// 🛠️ Helpers
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
