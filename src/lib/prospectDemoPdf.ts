import jsPDF from "jspdf";

// Data passed in from the Prospect Demo screen. All optional/nullable
// because the rep may export at any point — even before captures finish.
export interface ProspectDemoPdfData {
  dealerName: string;
  homeUrl: string;
  listingUrl: string;
  vdpUrl: string;
  screenshots: {
    home: string | null;
    listing: string | null;
    vdp: string | null;
  };
  config: {
    buttonColor: string;
    buttonText: string;
    bannerHeadline: string;
    bannerCtaText: string;
    stickyText: string;
    stickyCtaText: string;
    pptEnabled: boolean;
    pptButtonText: string;
  };
  pitchLine?: string | null;
  shareUrl?: string | null;
  generatedBy?: string | null;
}

const PAGE_W = 612;   // Letter, points
const PAGE_H = 792;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  text: [30, 41, 59] as [number, number, number],   // slate-800
  muted: [100, 116, 139] as [number, number, number], // slate-500
  accent: [37, 99, 235] as [number, number, number],  // blue-600
  border: [226, 232, 240] as [number, number, number], // slate-200
  bandBg: [248, 250, 252] as [number, number, number], // slate-50
};

const setFill = (doc: jsPDF, c: [number, number, number]) =>
  doc.setFillColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: [number, number, number]) =>
  doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) =>
  doc.setDrawColor(c[0], c[1], c[2]);

// Get pixel dimensions out of a base64/data URL screenshot so we can
// preserve aspect ratio when placing it on the PDF page.
const loadImageDims = (src: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });

const ensureSpace = (doc: jsPDF, y: number, needed: number): number => {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
};

const drawHeader = (doc: jsPDF, dealerName: string) => {
  // Accent band
  setFill(doc, COLORS.accent);
  doc.rect(0, 0, PAGE_W, 6, "F");

  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("PROSPECT DEMO REPORT", MARGIN, 28);

  setText(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(dealerName || "Unnamed Prospect", MARGIN, 50);

  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleString()}`,
    PAGE_W - MARGIN,
    28,
    { align: "right" },
  );

  return 70;
};

const drawSectionTitle = (doc: jsPDF, title: string, y: number): number => {
  y = ensureSpace(doc, y, 24);
  setText(doc, COLORS.accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), MARGIN, y);
  setDraw(doc, COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 4, PAGE_W - MARGIN, y + 4);
  return y + 18;
};

const drawKeyValue = (doc: jsPDF, key: string, value: string, y: number): number => {
  y = ensureSpace(doc, y, 16);
  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(key.toUpperCase(), MARGIN, y);

  setText(doc, COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(value || "—", CONTENT_W);
  doc.text(lines, MARGIN, y + 12);
  return y + 12 + lines.length * 12 + 6;
};

const drawScreenshot = async (
  doc: jsPDF,
  label: string,
  url: string,
  dataUrl: string,
  y: number,
): Promise<number> => {
  // Section title
  y = ensureSpace(doc, y, 30);
  setText(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(label, MARGIN, y);
  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const urlLines = doc.splitTextToSize(url, CONTENT_W);
  doc.text(urlLines, MARGIN, y + 12);
  y += 12 + urlLines.length * 10;

  try {
    const dims = await loadImageDims(dataUrl);
    const scale = CONTENT_W / dims.w;
    const renderH = Math.min(dims.h * scale, PAGE_H - MARGIN - y - 10);
    const renderW = renderH < dims.h * scale ? renderH * (dims.w / dims.h) : CONTENT_W;
    y = ensureSpace(doc, y, renderH + 10);
    // Border around screenshot
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN, y, renderW, renderH);
    const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, fmt, MARGIN, y, renderW, renderH);
    y += renderH + 10;
  } catch (e) {
    console.warn("Failed to embed screenshot:", e);
    setText(doc, COLORS.muted);
    doc.setFontSize(9);
    doc.text("(Screenshot could not be embedded)", MARGIN, y + 14);
    y += 24;
  }
  return y;
};

export async function generateProspectDemoPdf(data: ProspectDemoPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  let y = drawHeader(doc, data.dealerName);

  // Pitch line callout (if AI generated one)
  if (data.pitchLine) {
    y = ensureSpace(doc, y, 60);
    setFill(doc, COLORS.bandBg);
    setDraw(doc, COLORS.accent);
    doc.setLineWidth(2);
    doc.setLineDashPattern([], 0);
    const lines = doc.splitTextToSize(`"${data.pitchLine}"`, CONTENT_W - 24);
    const boxH = 14 + lines.length * 14 + 14;
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 4, 4, "FD");
    setText(doc, COLORS.text);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text(lines, MARGIN + 12, y + 22);
    y += boxH + 16;
  }

  // ── Prospect Info ──
  y = drawSectionTitle(doc, "Prospect Information", y);
  y = drawKeyValue(doc, "Dealer", data.dealerName || "—", y);
  y = drawKeyValue(doc, "Homepage", data.homeUrl || "—", y);
  if (data.listingUrl) y = drawKeyValue(doc, "Inventory page", data.listingUrl, y);
  if (data.vdpUrl) y = drawKeyValue(doc, "Vehicle detail page", data.vdpUrl, y);

  // ── Branding & Copy ──
  y += 6;
  y = drawSectionTitle(doc, "Configured Branding & Copy", y);
  y = ensureSpace(doc, y, 30);
  // Color swatch
  setText(doc, COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("BUTTON COLOR", MARGIN, y);
  try {
    const hex = data.config.buttonColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    doc.setFillColor(r, g, b);
    doc.rect(MARGIN, y + 4, 20, 14, "F");
    setText(doc, COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(data.config.buttonColor, MARGIN + 26, y + 14);
  } catch {
    /* ignore color parse */
  }
  y += 26;
  y = drawKeyValue(doc, "Primary CTA", data.config.buttonText, y);
  y = drawKeyValue(doc, "Banner headline", data.config.bannerHeadline, y);
  y = drawKeyValue(doc, "Banner CTA", data.config.bannerCtaText, y);
  y = drawKeyValue(doc, "Sticky bar text", data.config.stickyText, y);
  y = drawKeyValue(doc, "Sticky bar CTA", data.config.stickyCtaText, y);
  if (data.config.pptEnabled) {
    y = drawKeyValue(doc, "Push-Pull-Tow badge", data.config.pptButtonText, y);
  }

  // ── Share link ──
  if (data.shareUrl) {
    y += 6;
    y = drawSectionTitle(doc, "Live Demo Link", y);
    y = drawKeyValue(doc, "Shareable URL", data.shareUrl, y);
  }

  // ── Screenshots — one per page for max legibility ──
  const shots: Array<{ label: string; url: string; data: string }> = [];
  if (data.screenshots.home) {
    shots.push({ label: "Homepage Mockup", url: data.homeUrl, data: data.screenshots.home });
  }
  if (data.screenshots.listing) {
    shots.push({ label: "Inventory Page Mockup", url: data.listingUrl, data: data.screenshots.listing });
  }
  if (data.screenshots.vdp) {
    shots.push({ label: "Vehicle Detail Page Mockup", url: data.vdpUrl, data: data.screenshots.vdp });
  }

  for (const shot of shots) {
    doc.addPage();
    y = MARGIN;
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("PROSPECT DEMO — " + (data.dealerName || "Untitled"), MARGIN, y);
    y += 14;
    y = await drawScreenshot(doc, shot.label, shot.url || "", shot.data, y);
  }

  // ── Footer page numbers ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setText(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 20, { align: "right" });
    doc.text("Generated by AutoCurb Prospect Demo Builder", MARGIN, PAGE_H - 20);
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
