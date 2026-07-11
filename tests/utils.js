// Shared helpers for the Playwright smoke tests.

// Covers the common emoji blocks used across the site's history
// (dingbats, misc symbols, supplemental symbols/pictographs, regional flags).
const EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

async function assertNoEmoji(page) {
  const html = await page.evaluate(() => document.body.innerHTML);
  const match = html.match(EMOJI_RE);
  if (match) {
    throw new Error(`Found an emoji-range character in the page: ${JSON.stringify(match[0])}`);
  }
}

module.exports = { EMOJI_RE, assertNoEmoji };
