// One-shot HTML → PDF for the competitive audit. Lives in docs/ next
// to the source HTML so anyone can regenerate the PDF after edits.
//
//   npm i --no-save puppeteer
//   node docs/build-audit-pdf.cjs
//
// Output: docs/sell-flow-competitive-audit.pdf

const path = require("path");
const puppeteer = require("puppeteer");

const SRC = path.join(__dirname, "sell-flow-competitive-audit.html");
const OUT = path.join(__dirname, "sell-flow-competitive-audit.pdf");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto("file://" + SRC, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    await page.pdf({
      path: OUT,
      format: "Letter",
      printBackground: true,
      margin: { top: "0.6in", right: "0.6in", bottom: "0.7in", left: "0.6in" },
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size:8px;color:#888;width:100%;padding:0 0.6in;text-align:right;">Sell-Your-Car Competitive Audit · May 2026</div>',
      footerTemplate: '<div style="font-size:8px;color:#888;width:100%;padding:0 0.6in;display:flex;justify-content:space-between;"><span>Internal review</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    });
    console.log("Wrote " + OUT);
  } finally {
    await browser.close();
  }
})();
