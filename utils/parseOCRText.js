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
    phoneNumber: "",
    additionalPhones: [],
    email: "",
    company: "",
    website: "",
    notes: "", // will remain blank
  };

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/;
  const phoneRegex = /(\+?\d[\d\s\-]{7,15}\d)/;
  const websiteRegex = /(https?:\/\/)?(www\.)?([a-zA-Z0-9\-]+\.)+[a-z]{2,}/i;

  const usedLines = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract email
    if (!result.email && emailRegex.test(line)) {
      result.email = line.match(emailRegex)[0];
      usedLines.add(i);
      continue;
    }

    // Extract phone
    if (phoneRegex.test(line)) {
      const phone = line.match(phoneRegex)[0].replace(/\s+/g, "");
      if (!result.phoneNumber) result.phoneNumber = phone;
      else result.additionalPhones.push(phone);
      usedLines.add(i);
      continue;
    }

    // Extract website
    if (!result.website && websiteRegex.test(line)) {
      result.website = line.match(websiteRegex)[0]
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "");
      usedLines.add(i);
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
      usedLines.add(i);
      continue;
    }

    // Extract position
    if (
      !result.position &&
      /(Director|Manager|Chief|CEO|Engineer|Consultant|Officer|Representative|President)/i.test(line)
    ) {
      result.position = line;
      usedLines.add(i);
      continue;
    }

    // Extract company
    if (
      !result.company &&
      /(Co\.|Ltd\.|Inc\.|Company|Corporation)/i.test(line)
    ) {
      result.company = line;
      usedLines.add(i);
      continue;
    }
  }

  // No junk -> leave notes blank
  result.notes = "";

  return result;
}

module.exports = parseOCRText;
