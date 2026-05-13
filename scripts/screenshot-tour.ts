/**
 * Live screenshot tour of HarteCash.
 *
 * Captures the customer journey (public, unauthenticated) and the admin
 * panel (authenticated) as PNGs into ./screenshots/<run-timestamp>/.
 *
 * Setup (one-time)
 *   npm install                      # picks up playwright + tsx
 *   npx playwright install chromium  # downloads the headless browser
 *   cp .env.screenshot.example .env.screenshot
 *   # edit .env.screenshot with your target URL + admin creds
 *
 * Run
 *   npm run screenshots
 *
 * Output
 *   screenshots/2026-05-13T18-30-00Z/
 *     01-public-home-desktop.png
 *     01-public-home-mobile.png
 *     ...
 *     20-admin-dealer-tenants-desktop.png
 *
 * Configurable via .env.screenshot:
 *   BASE_URL              required — https://hartecash.com or Lovable preview URL
 *   ADMIN_EMAIL           optional — skip admin tour if omitted
 *   ADMIN_PASSWORD        optional
 *   DEMO_TOKEN            optional — submission token for /portal/<token> and /offer/<token>
 *   VIEWPORTS             optional — "desktop", "mobile", or "both" (default: both)
 */

import { chromium, type Browser, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  const file = ".env.screenshot";
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
const BASE_URL = (env.BASE_URL || "").replace(/\/$/, "");
const ADMIN_EMAIL = env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "";
const DEMO_TOKEN = env.DEMO_TOKEN || "";
const VIEWPORTS = (env.VIEWPORTS || "both").toLowerCase();

if (!BASE_URL) {
  console.error("✗ BASE_URL is required. Copy .env.screenshot.example to .env.screenshot and fill it in.");
  process.exit(1);
}

const DESKTOP = { width: 1440, height: 900, name: "desktop" };
const MOBILE = { width: 390, height: 844, name: "mobile" };
const VIEWPORT_SET = VIEWPORTS === "desktop" ? [DESKTOP] : VIEWPORTS === "mobile" ? [MOBILE] : [DESKTOP, MOBILE];

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
const OUTDIR = join("screenshots", ts);

// ─────────────────────────────────────────────────────────────
// Tour definitions
// ─────────────────────────────────────────────────────────────

interface Shot {
  name: string;
  path: string;
  waitFor?: string; // CSS selector to wait for
  scroll?: number;  // px to scroll before snapping
  fullPage?: boolean;
  delayMs?: number; // extra settle time after waits (animations)
}

const PUBLIC_TOUR: Shot[] = [
  { name: "01-public-home",       path: "/",            fullPage: true,  delayMs: 800 },
  { name: "02-public-sell",       path: "/sell",        fullPage: true,  delayMs: 800 },
  { name: "03-public-howitworks", path: "/how-it-works",fullPage: true,  delayMs: 500 },
  { name: "04-public-about",      path: "/about",       fullPage: true,  delayMs: 500 },
  { name: "05-public-faq",        path: "/faq",         fullPage: true,  delayMs: 500 },
  { name: "06-public-trade",      path: "/trade",       fullPage: true,  delayMs: 500 },
  { name: "07-public-service",    path: "/service",     fullPage: true,  delayMs: 500 },
  { name: "08-public-group",      path: "/group",       fullPage: true,  delayMs: 500 },
  { name: "09-public-quickoffer", path: "/quick-offer", fullPage: true,  delayMs: 500 },
  { name: "10-public-docs",       path: "/docs",        fullPage: true,  delayMs: 500 },
  { name: "11-public-updates",    path: "/updates",     fullPage: true,  delayMs: 500 },
  { name: "12-public-privacy",    path: "/privacy",     fullPage: true,  delayMs: 300 },
  { name: "13-public-terms",      path: "/terms",       fullPage: true,  delayMs: 300 },
];

// Pitch + marketing decks. Larger delayMs lets framer-motion scroll
// reveals settle before the camera fires.
const PITCH_TOUR: Shot[] = [
  { name: "14-pitch-deck",        path: "/pitch",    fullPage: true,  delayMs: 1500 },
  { name: "15-platform-pitch",    path: "/platform", fullPage: true,  delayMs: 1500 },
];

// AutocurbLanding renders only when window.location.hostname is
// autocurb.io / www.autocurb.io (see isAutocurbHost() in App.tsx).
// Captured in its own context with a Location.prototype.hostname
// override so the page believes it's serving from the marketing host.
const AUTOCURB_LANDING: Shot = {
  name: "16-autocurb-landing", path: "/", fullPage: true, delayMs: 1000,
};

const PORTAL_TOUR: Shot[] = DEMO_TOKEN
  ? [
      { name: "17-customer-portal", path: `/portal/${DEMO_TOKEN}`, fullPage: true, delayMs: 800 },
      { name: "18-customer-offer",  path: `/offer/${DEMO_TOKEN}`,  fullPage: true, delayMs: 1200 },
      { name: "19-customer-deal",   path: `/deal/${DEMO_TOKEN}`,   fullPage: true, delayMs: 800 },
      { name: "20-customer-watch",  path: `/watch-my-car/${DEMO_TOKEN}`, fullPage: true, delayMs: 800 },
    ]
  : [];

const ADMIN_TOUR: Shot[] = [
  { name: "21-admin-dashboard",        path: "/admin",                                       fullPage: true, delayMs: 800 },
  { name: "22-admin-pipeline",         path: "/admin?section=submissions",                   fullPage: true, delayMs: 800 },
  { name: "23-admin-equity-mining",    path: "/admin?section=equity-mining",                 fullPage: true, delayMs: 600 },
  { name: "24-admin-voice-ai",         path: "/admin?section=voice-ai",                      fullPage: true, delayMs: 600 },
  { name: "25-admin-performance",      path: "/admin?section=performance",                   fullPage: true, delayMs: 600 },
  { name: "26-admin-reports",          path: "/admin?section=reports",                       fullPage: true, delayMs: 600 },
  { name: "27-admin-branding",         path: "/admin?section=branding",                      fullPage: true, delayMs: 600 },
  { name: "28-admin-pricing-rules",    path: "/admin?section=pricing-rules",                 fullPage: true, delayMs: 600 },
  { name: "29-admin-integrations",     path: "/admin?section=integrations",                  fullPage: true, delayMs: 600 },
  { name: "30-admin-staff",            path: "/admin?section=staff",                         fullPage: true, delayMs: 600 },
  { name: "31-admin-dealer-tenants",   path: "/admin?section=tenants",                       fullPage: true, delayMs: 800 },
  { name: "32-admin-audit-log",        path: "/admin?section=audit-log",                     fullPage: true, delayMs: 600 },
  { name: "33-admin-executive",        path: "/executive",                                   fullPage: true, delayMs: 800 },
  { name: "34-admin-super",            path: "/super-admin",                                 fullPage: true, delayMs: 800 },
];

// ─────────────────────────────────────────────────────────────
// Snapping
// ─────────────────────────────────────────────────────────────

async function snap(page: Page, shot: Shot, viewport: typeof DESKTOP) {
  const url = `${BASE_URL}${shot.path}`;
  console.log(`  → ${viewport.name.padEnd(8)} ${shot.name}  ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  } catch {
    // Some pages keep long-poll connections open and never hit networkidle.
    // Falling back to domcontentloaded gives us a usable screenshot.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }
  if (shot.waitFor) {
    await page.waitForSelector(shot.waitFor, { timeout: 10_000 }).catch(() => {});
  }
  if (shot.scroll) await page.evaluate((y) => window.scrollTo(0, y), shot.scroll);
  if (shot.delayMs) await page.waitForTimeout(shot.delayMs);

  const file = join(OUTDIR, `${shot.name}-${viewport.name}.png`);
  await page.screenshot({ path: file, fullPage: !!shot.fullPage });
}

async function loginAdmin(page: Page): Promise<boolean> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("⏭  Skipping admin tour — ADMIN_EMAIL / ADMIN_PASSWORD not set.");
    return false;
  }
  console.log("  → admin login");
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "domcontentloaded" });
  // The login page renders both sign-in and sign-up forms (often
  // behind a tab). `.first()` picks the visible sign-in form's email
  // input deterministically without strict-mode complaints.
  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  try {
    // Login lands on /admin (success) or stays on /admin/login (failure).
    // Match the success path only.
    await page.waitForURL((url) => url.pathname === "/admin" || url.pathname.startsWith("/admin/") && url.pathname !== "/admin/login", { timeout: 20_000 });
    return true;
  } catch {
    console.error("✗ Admin login failed — check ADMIN_EMAIL / ADMIN_PASSWORD.");
    return false;
  }
}

async function captureAutocurbLanding(browser: Browser, viewport: typeof DESKTOP) {
  // AutocurbLanding only renders when window.location.hostname matches
  // the marketing host. We can't change the real hostname Playwright
  // hits (the deployment lives at BASE_URL), so we patch the Location
  // prototype before any app script runs. React reads hostname on
  // first render of RootLanding, so the override fires before mount.
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    try {
      Object.defineProperty(Location.prototype, "hostname", {
        get() { return "autocurb.io"; },
        configurable: true,
      });
    } catch {
      // Some browsers protect Location.prototype; if so, the override
      // silently fails and we fall through to the default landing.
    }
  });
  const page = await ctx.newPage();
  console.log(`  → ${viewport.name.padEnd(8)} ${AUTOCURB_LANDING.name}  ${BASE_URL}/  (hostname override → autocurb.io)`);
  await snap(page, AUTOCURB_LANDING, viewport);
  await ctx.close();
}

async function runViewport(browser: Browser, viewport: typeof DESKTOP) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  console.log(`\n▶ ${viewport.name} (${viewport.width}×${viewport.height})`);
  for (const shot of PUBLIC_TOUR) await snap(page, shot, viewport);
  for (const shot of PITCH_TOUR) await snap(page, shot, viewport);
  for (const shot of PORTAL_TOUR) await snap(page, shot, viewport);

  const loggedIn = await loginAdmin(page);
  if (loggedIn) {
    for (const shot of ADMIN_TOUR) await snap(page, shot, viewport);
  }

  await ctx.close();
}

async function writeIndex(shots: Shot[]) {
  const lines: string[] = [
    `# Screenshot tour — ${ts}`,
    "",
    `Base URL: \`${BASE_URL}\``,
    `Demo token: ${DEMO_TOKEN ? `\`${DEMO_TOKEN}\`` : "_not set_"}`,
    `Admin tour: ${ADMIN_EMAIL ? "✓" : "✗ skipped"}`,
    "",
    "## Files",
    "",
  ];
  for (const shot of shots) {
    for (const v of VIEWPORT_SET) {
      lines.push(`- \`${shot.name}-${v.name}.png\` — ${shot.path}`);
    }
  }
  await writeFile(join(OUTDIR, "INDEX.md"), lines.join("\n") + "\n");
}

async function main() {
  await mkdir(OUTDIR, { recursive: true });
  console.log(`Capturing into ${OUTDIR}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const v of VIEWPORT_SET) await runViewport(browser, v);
    // AutocurbLanding runs in its own context per viewport because it
    // needs a hostname override that the rest of the tour should not
    // inherit.
    for (const v of VIEWPORT_SET) await captureAutocurbLanding(browser, v);
  } finally {
    await browser.close();
  }

  await writeIndex([...PUBLIC_TOUR, ...PITCH_TOUR, ...PORTAL_TOUR, ...ADMIN_TOUR, AUTOCURB_LANDING]);
  console.log(`\n✓ Done. Open ${join(OUTDIR, "INDEX.md")} for the full list.`);
}

main().catch((e) => {
  console.error("✗ Tour failed:", e);
  process.exit(1);
});
