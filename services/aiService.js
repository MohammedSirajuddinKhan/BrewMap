const axios = require("axios");

const GEMINI_API = process.env.GEMINI_API_URL || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

async function generateVibeSummary(cafe) {
  const prompt = `Summarize the vibe for this cafe named ${cafe.name} located at ${cafe.address}. Include likely crowd, best times, and ideal activities (coding, studying, meetings).`;

  if (!GEMINI_KEY || !GEMINI_API) {
    // Dev fallback: deterministic short summary
    return `${cafe.name} — cozy spot with moderate foot traffic; good for ${cafe.amenities.codingFriendly ? "coding and remote work" : "casual visits"} and ${cafe.amenities.vegan ? "vegan options" : "standard menu"}.`;
  }

  const res = await axios.post(
    GEMINI_API,
    { prompt },
    { headers: { Authorization: `Bearer ${GEMINI_KEY}` } },
  );
  return res.data?.output || "";
}

module.exports = { generateVibeSummary };
