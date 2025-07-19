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
    notes: "", // intentionally left empty
  };

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/;
  const phoneRegex = /(\+?\d[\d\s\-]{7,15}\d)/;
  const websiteRegex = /(https?:\/\/)?(www\.)?([a-zA-Z0-9\-]+\.)+[a-z]{2,}/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract email
    if (!result.email && emailRegex.test(line)) {
      result.email = line.match(emailRegex)[0];
      continue;
    }

    // Extract phone
    if (phoneRegex.test(line)) {
      const phone = line.match(phoneRegex)[0].replace(/[^\d+]/g, "");
      if (!result.phoneNumber) result.phoneNumber = phone;
      else result.additionalPhones.push(phone);
      continue;
    }

    // Extract website
    if (!result.website && websiteRegex.test(line)) {
      result.website = line
        .match(websiteRegex)[0]
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "");
      continue;
    }

    // Extract name (basic heuristic)
    if (
      !result.firstName &&
      /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(line)
    ) {
      const [first, last] = line.split(" ");
      result.firstName = first;
      result.lastName = last;
      continue;
    }

    // Extract position/title
    if (
      !result.position &&
      /(Director|Manager|Chief|CEO|Engineer|Consultant|Officer|Representative|President)/i.test(line)
    ) {
      result.position = line;
      continue;
    }

    // Extract company
    if (
      !result.company &&
      /(Co\.|Ltd\.|Inc\.|Company|Corporation)/i.test(line)
    ) {
      result.company = line;
      continue;
    }
  }

  // Fallback: name from email
  if (!result.firstName && result.email.includes("@")) {
    const namePart = result.email.split("@")[0]; // e.g. kalanyoo.ammaranon
    const [first, last] = namePart.split(".");
    if (first && last) {
      result.firstName = capitalize(first);
      result.lastName = capitalize(last);
    }
  }

  // Fallback: website from email
  if (!result.website && result.email.includes("@")) {
    result.website = result.email.split("@")[1];
  }

  // Fallback: company from email domain
  if (!result.company && result.email.includes("@")) {
    const domain = result.email.split("@")[1];
    const name = domain.split(".")[0];
    result.company = capitalizeWords(name.replace(/[^a-zA-Z ]/g, ""));
  }

  // Notes stay blank
  result.notes = "";

  return result;
}

// Helpers
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function capitalizeWords(text) {
  return text
    .split(/[\s._-]+/)
    .map(capitalize)
    .join(" ");
}

module.exports = parseOCRText;
