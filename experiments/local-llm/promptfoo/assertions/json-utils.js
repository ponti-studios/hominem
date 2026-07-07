// Models frequently wrap JSON in ```json fences despite being told not to.
// Shared by every assertion file that needs to parse a model's JSON output.
function parseModelJson(output) {
  const stripped = output
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(stripped);
}

module.exports = { parseModelJson };
