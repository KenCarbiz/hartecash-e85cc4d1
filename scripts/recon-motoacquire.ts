/**
 * MotoAcquire reconnaissance — competitive-intel walkthrough of
 * sellyourcar.online (and any creator/dealer subdomain you point it at).
 *
 * What it does:
 *   1. Opens the configured landing page in headless Chromium.
 *   2. Records every XHR/fetch request the page makes (URL, method, status,
 *      response JSON when it's JSON) to a HAR-like JSON file.
 *   3. Walks the consumer flow with a known sample vehicle, screenshotting
 *      every step.
 *   4. Extracts visible form fields per step (name, type, placeholder,
 *      options) to a fields.json so we can diff against our own /sell flow.
 *   5. Dumps the valuation API response (if any) to a separate file for
 *      offer-curve benchmarking.
 *
 * What it deliberately does NOT do:
 *   - Submit fake contact info or fake VINs at scale.
 *   - Hit the valuation API outside the normal page-driven flow.
 *   - Re-run on a schedule. Run it manually, ~quarterly, against one URL.
 *
 * NOTE — this script will NOT work from the build sandbox; the egress
 * proxy 403s sellyourcar.online and motoacquire.com. Run it from a
 * personal machine.
 *
 * One-time setup
 *   npm install
 *   npx playwright install chromium
 *   cp .env.recon.example .env.recon
 *   # edit .env.recon with the target URL + a sample vehicle to quote
 *
 * Run
 *   npx tsx scripts/recon-motoacquire.ts
 *
 * Output
 *   recon/2026-05-14T13-45-00Z/
 *     00-landing.png
 *     01-after-plate.png
 *     ...
 *     network.json    — every XHR/fetch the page made
 *     fields.json     — visible form fields per step
 *     valuation.json  — best-guess valuation response, if found
 *     INDEX.md        — what's in this folder
 *
 * `.env.recon` and `recon/` are git-ignored.
 */

import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  const file = ".env.recon";
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    const v = vRaw.replace(/^["']|["']$/g, "");
    if (!out[k]) out[k] = v;
  }
  return out;
}

const env = loadEnv();
const TARGET_URL = (env.TARGET_URL || "https://sellyourcar.online").replace(/\/$/, "");
const SAMPLE_VIN = env.SAMPLE_VIN || "";
const SAMPLE_PLATE = env.SAMPLE_PLATE || "";
const SAMPLE_STATE = env.SAMPLE_STATE || "";
const SAMPLE_ZIP = env.SAMPLE_ZIP || "06810";
const SAMPLE_MILEAGE = env.SAMPLE_MILEAGE || "62500";
const HEADFUL = env.HEADFUL === "1";

if (!SAMPLE_VIN && !(SAMPLE_PLATE && SAMPLE_STATE)) {
  console.error(
    "Need SAMPLE_VIN, or both SAMPLE_PLATE + SAMPLE_STATE, in .env.recon. " +
      "Use a vehicle you actually own — do not fabricate."
  );
  process.exit(1);
}

const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z");
const OUT_DIR = join("recon", RUN_ID);

// ─────────────────────────────────────────────────────────────
// Network capture
// ─────────────────────────────────────────────────────────────

type NetEntry = {
  step: string;
  ts: string;
  url: string;
  method: string;
  status?: number;
  contentType?: string;
  requestHeaders: Record<string, string>;
  requestPostData?: string;
  responseBodyPreview?: unknown;
};

const network: NetEntry[] = [];
let currentStep = "init";

function shouldCapture(url: string): boolean {
  // XHR / fetch only; skip static asset chatter.
  if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|eot|css|js|map)(\?|$)/i.test(url)) return false;
  if (/google-analytics|googletagmanager|hotjar|segment|fullstory|sentry|datadog/i.test(url)) return false;
  return true;
}

function attachNetworkListeners(context: BrowserContext) {
  context.on("response", async (res: Response) => {
    const req = res.request();
    if (!shouldCapture(req.url())) return;
    const headers = res.headers();
    const ct = headers["content-type"] || "";
    let bodyPreview: unknown = undefined;
    try {
      if (/application\/json/i.test(ct)) {
        bodyPreview = await res.json();
      } else if (/text\/(plain|html)/i.test(ct)) {
        const text = await res.text();
        bodyPreview = text.length > 2000 ? text.slice(0, 2000) + "…[truncated]" : text;
      }
    } catch {
      // Body unreadable (binary, aborted, etc.) — leave undefined.
    }
    network.push({
      step: currentStep,
      ts: new Date().toISOString(),
      url: req.url(),
      method: req.method(),
      status: res.status(),
      contentType: ct,
      requestHeaders: req.headers(),
      requestPostData: req.postData() ?? undefined,
      responseBodyPreview: bodyPreview,
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function snap(page: Page, name: string) {
  currentStep = name;
  const path = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
}

async function dumpVisibleFields(page: Page, step: string) {
  const fields = await page.evaluate(() => {
    const out: Array<Record<string, unknown>> = [];
    const seen = new Set<Element>();
    for (const el of Array.from(document.querySelectorAll("input, select, textarea, button[type='submit']"))) {
      if (seen.has(el)) continue;
      seen.add(el);
      const rect = (el as HTMLElement).getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (!visible) continue;
      const tag = el.tagName.toLowerCase();
      const e = el as HTMLInputElement;
      const labelFor = e.id ? document.querySelector(`label[for="${CSS.escape(e.id)}"]`) : null;
      out.push({
        tag,
        type: e.type || null,
        name: e.name || null,
        id: e.id || null,
        placeholder: e.placeholder || null,
        ariaLabel: e.getAttribute("aria-label"),
        labelText: labelFor?.textContent?.trim() ?? null,
        required: e.required ?? null,
        autocomplete: e.autocomplete || null,
        options:
          tag === "select"
            ? Array.from((e as unknown as HTMLSelectElement).options).map((o) => o.value)
            : undefined,
      });
    }
    return out;
  });
  return { step, capturedAt: new Date().toISOString(), fields };
}

const fieldSnapshots: Array<Awaited<ReturnType<typeof dumpVisibleFields>>> = [];

async function recordFields(page: Page, step: string) {
  fieldSnapshots.push(await dumpVisibleFields(page, step));
}

async function tryFillByLabels(page: Page, candidates: string[], value: string): Promise<boolean> {
  for (const c of candidates) {
    const locator = page.getByLabel(new RegExp(c, "i")).first();
    if (await locator.count().catch(() => 0)) {
      try {
        await locator.fill(value, { timeout: 1500 });
        return true;
      } catch {
        // try next
      }
    }
    const ph = page.getByPlaceholder(new RegExp(c, "i")).first();
    if (await ph.count().catch(() => 0)) {
      try {
        await ph.fill(value, { timeout: 1500 });
        return true;
      } catch {
        // try next
      }
    }
  }
  return false;
}

async function clickByText(page: Page, patterns: string[]): Promise<boolean> {
  for (const p of patterns) {
    const btn = page.getByRole("button", { name: new RegExp(p, "i") }).first();
    if (await btn.count().catch(() => 0)) {
      try {
        await btn.click({ timeout: 2000 });
        return true;
      } catch {
        /* next */
      }
    }
    const link = page.getByRole("link", { name: new RegExp(p, "i") }).first();
    if (await link.count().catch(() => 0)) {
      try {
        await link.click({ timeout: 2000 });
        return true;
      } catch {
        /* next */
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Main walk
// ─────────────────────────────────────────────────────────────

async function walk(page: Page) {
  // ── Landing ─────────────────────────────────────────────
  currentStep = "00-landing";
  console.log(`→ Landing: ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => null);
  await snap(page, "00-landing");
  await recordFields(page, "00-landing");

  // ── Step 1: VIN or plate ────────────────────────────────
  currentStep = "01-vehicle-identifier";
  let entered = false;
  if (SAMPLE_VIN) {
    entered = await tryFillByLabels(page, ["vin", "vehicle identification"], SAMPLE_VIN);
  }
  if (!entered && SAMPLE_PLATE) {
    entered = await tryFillByLabels(page, ["plate", "license"], SAMPLE_PLATE);
    if (SAMPLE_STATE) {
      await tryFillByLabels(page, ["state"], SAMPLE_STATE);
    }
  }
  if (!entered) {
    console.warn(
      "  ⚠ Could not locate VIN/plate input by label or placeholder. " +
        "Field selectors may have changed; inspect 00-landing.png and update tryFillByLabels candidates."
    );
  }
  await snap(page, "01-vehicle-identifier");
  await recordFields(page, "01-vehicle-identifier");

  await clickByText(page, ["get.{0,8}(offer|value|quote|started)", "continue", "next", "see (my )?value"]);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => null);

  // ── Step 2: zip / mileage / condition ───────────────────
  currentStep = "02-vehicle-details";
  await tryFillByLabels(page, ["zip", "postal"], SAMPLE_ZIP);
  await tryFillByLabels(page, ["mile", "odometer"], SAMPLE_MILEAGE);
  await snap(page, "02-vehicle-details");
  await recordFields(page, "02-vehicle-details");

  await clickByText(page, ["continue", "next", "get.{0,8}offer", "see value"]);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => null);

  // ── Step 3: range/firm offer screen ─────────────────────
  currentStep = "03-valuation";
  await page.waitForTimeout(2000); // let any client-side animation settle
  await snap(page, "03-valuation");
  await recordFields(page, "03-valuation");

  // ── Step 4: try to advance one more screen to see the firm-offer upsell ──
  currentStep = "04-firm-offer-prompt";
  await clickByText(page, ["firm offer", "upgrade", "get.{0,8}firm", "tell us more", "continue"]);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await snap(page, "04-firm-offer-prompt");
  await recordFields(page, "04-firm-offer-prompt");

  // STOP. We do not submit contact info, do not opt into emails,
  // do not push past a real human consent boundary.
}

// ─────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────

function pickValuationEntry(): NetEntry | undefined {
  // Heuristic: pick the largest JSON response that looks like a valuation.
  const candidates = network.filter(
    (e) =>
      typeof e.responseBodyPreview === "object" &&
      e.responseBodyPreview !== null &&
      JSON.stringify(e.responseBodyPreview).match(/\b(value|low|high|offer|range|kbb|blackbook|appraisal)\b/i)
  );
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => JSON.stringify(b.responseBodyPreview).length - JSON.stringify(a.responseBodyPreview).length);
  return candidates[0];
}

async function writeOutputs() {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, "network.json"), JSON.stringify(network, null, 2));
  await writeFile(join(OUT_DIR, "fields.json"), JSON.stringify(fieldSnapshots, null, 2));
  const val = pickValuationEntry();
  if (val) {
    await writeFile(join(OUT_DIR, "valuation.json"), JSON.stringify(val, null, 2));
  }
  const index = [
    `# MotoAcquire recon — ${RUN_ID}`,
    ``,
    `- target: ${TARGET_URL}`,
    `- sample: ${SAMPLE_VIN ? `VIN ${SAMPLE_VIN}` : `plate ${SAMPLE_PLATE} (${SAMPLE_STATE})`}, ${SAMPLE_MILEAGE} mi, zip ${SAMPLE_ZIP}`,
    `- captured ${network.length} XHR/fetch calls`,
    `- ${fieldSnapshots.length} field snapshots`,
    `- valuation response identified: ${val ? "yes — see valuation.json" : "no"}`,
    ``,
    `## Files`,
    ``,
    `- \`00-landing.png\` — landing page as loaded`,
    `- \`01-vehicle-identifier.png\` — after VIN/plate entry`,
    `- \`02-vehicle-details.png\` — after zip + mileage`,
    `- \`03-valuation.png\` — the range/offer screen`,
    `- \`04-firm-offer-prompt.png\` — firm-offer upsell, if reached`,
    `- \`network.json\` — every captured request with response body preview`,
    `- \`fields.json\` — visible form fields per step`,
    val ? `- \`valuation.json\` — best-guess valuation API response` : ``,
    ``,
    `## Reminders`,
    ``,
    `- Single run, single VIN. Do not loop.`,
    `- The site's ToS likely prohibits automated access; this script is for one-off competitive intel, not a continuous scraper.`,
    `- Do not republish copy or screenshots. Use as input to our own positioning, not as marketing material.`,
  ]
    .filter(Boolean)
    .join("\n");
  await writeFile(join(OUT_DIR, "INDEX.md"), index);
  console.log(`\n✓ Output in ${OUT_DIR}`);
}

// ─────────────────────────────────────────────────────────────
// Entry
// ─────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser: Browser = await chromium.launch({ headless: !HEADFUL });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  attachNetworkListeners(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  try {
    await walk(page);
  } catch (err) {
    console.error("Walk failed:", err);
    await snap(page, "ZZ-error-state").catch(() => null);
  } finally {
    await writeOutputs();
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
