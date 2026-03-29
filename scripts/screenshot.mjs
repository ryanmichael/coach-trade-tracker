#!/usr/bin/env node
/**
 * UI Screenshot Tool
 * Usage:
 *   node scripts/screenshot.mjs                        # Full page
 *   node scripts/screenshot.mjs --url /settings        # Specific route
 *   node scripts/screenshot.mjs --selector ".ticker"   # Specific element
 *   node scripts/screenshot.mjs --width 1440           # Custom viewport
 *   node scripts/screenshot.mjs --mobile               # Mobile viewport (390px)
 *   node scripts/screenshot.mjs --wait 3000            # Wait ms before capture
 */
import { chromium } from "playwright";
import { parseArgs } from "node:util";
import { resolve } from "node:path";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "/" },
    selector: { type: "string", short: "s" },
    width: { type: "string", default: "1280" },
    height: { type: "string", default: "900" },
    mobile: { type: "boolean", default: false },
    wait: { type: "string", default: "1500" },
    out: { type: "string", short: "o", default: "/tmp/ui-screenshot.png" },
    port: { type: "string", default: "3001" },
  },
});

const width = values.mobile ? 390 : parseInt(values.width);
const height = values.mobile ? 844 : parseInt(values.height);
const baseUrl = `http://localhost:${values.port}`;
const fullUrl = `${baseUrl}${values.url}`;
const outPath = resolve(values.out);

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  try {
    await page.goto(fullUrl, { waitUntil: "networkidle", timeout: 15000 });
  } catch {
    // networkidle can be flaky — fall back to domcontentloaded
    await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
  }

  // Extra wait for async renders (shimmer loaders, data fetches)
  await page.waitForTimeout(parseInt(values.wait));

  if (values.selector) {
    const el = await page.$(values.selector);
    if (el) {
      await el.screenshot({ path: outPath });
    } else {
      console.error(`Selector "${values.selector}" not found — taking full page`);
      await page.screenshot({ path: outPath, fullPage: true });
    }
  } else {
    await page.screenshot({ path: outPath, fullPage: true });
  }

  await browser.close();
  console.log(outPath);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
