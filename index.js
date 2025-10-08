// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

// Helper: convert Hacker News age text (e.g. "3 hours ago", "45 minutes ago", "yesterday")
// into a numeric timestamp (ms since epoch) using Date.now() as reference.
function parseAgeToTimestamp(ageText, now = Date.now()) {
  const lower = ageText.trim().toLowerCase();

  // Examples: "3 hours ago", "45 minutes ago", "2 days ago", "1 day ago", "just now"
  if (lower.includes("just now") || lower.includes("moments ago") || /\d+\s*sec/.test(lower)) {
    return now;
  }

  const minuteMatch = lower.match(/(\d+)\s*minute/);
  if (minuteMatch) {
    return now - parseInt(minuteMatch[1], 10) * 60 * 1000;
  }

  const hourMatch = lower.match(/(\d+)\s*hour/);
  if (hourMatch) {
    return now - parseInt(hourMatch[1], 10) * 60 * 60 * 1000;
  }

  const dayMatch = lower.match(/(\d+)\s*day/);
  if (dayMatch) {
    return now - parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000;
  }

  // fallback: if contains 'yesterday'
  if (lower.includes('yesterday')) {
    return now - 24 * 60 * 60 * 1000;
  }

  // If unrecognized, return NaN so we can detect parsing failures
  return NaN;
}

async function sortHackerNewsArticles() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
  const baseUrl = "https://news.ycombinator.com/newest";
  let url = baseUrl;
  const timestamps = [];
  const globalNow = Date.now();

    // Keep following "More" links until we collect 100 items (Hacker News paginates by 30)
    while (timestamps.length < 100) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Select all age elements for the articles on the page.
      // On Hacker News, the ages are in <span class="age"><a>...</a></span>
      const ages = await page.$$eval('span.age', nodes => nodes.map(n => n.innerText));

      for (const ageText of ages) {
        if (timestamps.length >= 100) break;
        const ts = parseAgeToTimestamp(ageText, globalNow);
        timestamps.push({ raw: ageText, ts });
      }

      // If we already have 100, break
      if (timestamps.length >= 100) break;

      // Find the "more" link to go to the next page
      const moreHref = await page.$eval('a.morelink', a => a ? a.href : null).catch(() => null);
      if (!moreHref) break; // no more pages
      url = moreHref;
    }

    if (timestamps.length !== 100) {
      console.error(`Expected to collect exactly 100 articles but collected ${timestamps.length}`);
      await browser.close();
      process.exitCode = 2;
      return;
    }

    // Ensure all timestamps parsed successfully
    const failed = timestamps.filter(t => Number.isNaN(t.ts));
    if (failed.length > 0) {
      console.error('Failed to parse some article ages:', failed.map(f => f.raw));
      await browser.close();
      process.exitCode = 3;
      return;
    }

    // Check sorted newest -> oldest: timestamps should be non-increasing
    let sorted = true;
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i].ts > timestamps[i - 1].ts) {
        sorted = false;
        console.error(`Order violation at index ${i - 1} -> ${i}: ${timestamps[i - 1].raw} (ts ${timestamps[i - 1].ts}) then ${timestamps[i].raw} (ts ${timestamps[i].ts})`);
        break;
      }
    }

    if (sorted) {
      console.log('PASS: First 100 articles are sorted from newest to oldest.');
      process.exitCode = 0;
    } else {
      console.error('FAIL: First 100 articles are NOT sorted from newest to oldest.');
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Error during validation:', err);
    process.exitCode = 4;
  } finally {
    await browser.close();
  }
}

(async () => {
  await sortHackerNewsArticles();
})();
