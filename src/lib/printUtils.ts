import { formatPhone } from "@/lib/utils";

// ── Types ──
interface PrintSubmission {
  id: string;
  token: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  zip: string | null;
  vin: string | null;
  plate: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  mileage: string | null;
  overall_condition: string | null;
  next_step: string | null;
  loan_status: string | null;
  exterior_color: string | null;
  drivetrain: string | null;
  modifications: string | null;
  exterior_damage: string[] | null;
  windshield_damage: string | null;
  moonroof: string | null;
  interior_damage: string[] | null;
  tech_issues: string[] | null;
  engine_issues: string[] | null;
  mechanical_issues: string[] | null;
  drivable: string | null;
  accidents: string | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  progress_status: string;
  offered_price: number | null;
  acv_value: number | null;
  internal_notes: string | null;
  appointment_set: boolean;
  appointment_date: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  lead_source: string;
}

interface ProgressStage {
  key: string;
  label: string;
  dbKeys: string[];
}

// ── Shared CSS ──
const basePrintCSS = [
  "* { margin: 0; padding: 0; box-sizing: border-box; }",
  "body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; color: #1a2a3a; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
].join("\n");

// ── Helpers ──
const makeRow = (label: string, value: string) =>
  '<div class="row"><span class="label">' + label + '</span><span class="value">' + value + "</span></div>";

const makeSection = (title: string, rows: [string, string | null | undefined][]) => {
  const valid = rows.filter(([, v]) => v != null && v !== "" && v !== "none");
  if (valid.length === 0) return "";
  return '<div class="section"><div class="section-title">' + title + '</div><div class="grid">' +
    valid.map(([l, v]) => makeRow(l, v!)).join("") + "</div></div>";
};

const arrVal = (a: string[] | null) =>
  a && a.length > 0 && !(a.length === 1 && a[0] === "none") ? a.join(", ") : null;

const makeDocSection = (title: string, images: string[]) =>
  images.length > 0 ? `<div class="doc-section"><h2>${title}</h2>${images.map(url => `<img class="doc-img" src="${url}" />`).join("")}</div>` : "";

const waitAndPrint = (win: Window, html: string) => {
  win.document.write(html);
  win.document.close();
  const images = win.document.querySelectorAll("img");
  let loaded = 0;
  const total = images.length;
  const triggerPrint = () => { win.focus(); win.print(); };
  if (total === 0) {
    setTimeout(triggerPrint, 200);
  } else {
    images.forEach(img => {
      img.onload = img.onerror = () => { loaded++; if (loaded >= total) setTimeout(triggerPrint, 200); };
    });
  }
};

// ── Print Submission Detail ──
export function printSubmissionDetail(
  s: PrintSubmission,
  photos: { url: string; name: string }[],
  docs: { name: string; url: string; type: string }[],
  stages: ProgressStage[],
  getStageIndex: (status: string) => number,
  docsUrl: string,
  docTypeLabels: Record<string, string>,
) {
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || null;
  const isDeadLead = s.progress_status === "dead_lead";
  const currentStageIdx = getStageIndex(s.progress_status);

  const css = basePrintCSS + "\n" + [
    ".header { background: #2a4365; color: white; padding: 20px 24px; }",
    ".header h1 { font-size: 20px; font-weight: 700; }",
    ".header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }",
    ".content { padding: 16px 24px; }",
    ".section { background: #f3f5f7; border: 1px solid #e2e6ea; border-radius: 8px; padding: 16px; margin-bottom: 14px; page-break-inside: avoid; }",
    ".section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7b8d; margin-bottom: 10px; }",
    ".grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }",
    ".row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e8ecef; }",
    ".row:last-child { border-bottom: none; }",
    ".label { font-size: 13px; color: #6b7b8d; }",
    ".value { font-size: 13px; font-weight: 500; text-align: right; max-width: 60%; }",
    ".stage { display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 6px; margin-bottom: 4px; }",
    ".stage-dot { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; flex-shrink: 0; }",
    ".stage-complete { background: rgba(56,161,105,0.15); }",
    ".stage-complete .stage-dot { background: #38a169; }",
    ".stage-current { background: rgba(229,62,62,0.2); }",
    ".stage-current .stage-dot { background: #e53e3e; }",
    ".stage-current .stage-label { font-weight: 700; }",
    ".stage-dead { background: rgba(229,62,62,0.15); }",
    ".stage-dead .stage-dot { background: #e53e3e; }",
    ".stage-dead .stage-label { font-weight: 700; color: #e53e3e; }",
    ".stage-label { font-size: 13px; }",
    ".stage-inactive .stage-label { color: #9aa5b4; }",
    ".stage-inactive .stage-dot { background: #d1d5db; }",
    ".photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }",
    ".photos-grid img { width: 100%; height: 100px; object-fit: cover; border-radius: 6px; }",
    ".doc-section { page-break-before: always; }",
    ".doc-section h3 { font-size: 13px; font-weight: 700; color: #4a5568; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }",
    ".doc-img { max-width: 100%; margin-bottom: 12px; border: 1px solid #d1d5db; border-radius: 6px; }",
    ".notes { white-space: pre-wrap; font-size: 13px; color: #4a5568; background: white; padding: 8px; border-radius: 4px; border: 1px solid #e2e6ea; }",
    "@page { margin: 0.5in; size: letter; }",
  ].join("\n");

  const progressHtml = stages.filter(st => st.key !== "dead_lead").map((st, i) => {
    const isComplete = !isDeadLead && i < currentStageIdx;
    const isCurrent = !isDeadLead && i === currentStageIdx;
    const cls = isComplete ? "stage stage-complete" : isCurrent ? "stage stage-current" : "stage stage-inactive";
    const dot = isComplete ? "✓" : isCurrent ? "●" : "○";
    return '<div class="' + cls + '"><div class="stage-dot">' + dot + '</div><span class="stage-label">' + st.label + "</span></div>";
  }).join("") + (isDeadLead ? '<div class="stage stage-dead"><div class="stage-dot">✕</div><span class="stage-label">Dead Lead</span></div>' : "");

  const photosHtml = photos.length > 0
    ? '<div class="section"><div class="section-title">Photos (' + photos.length + ')</div><div class="photos-grid">' +
      photos.map(p => '<img src="' + p.url + '" />').join("") + "</div></div>"
    : "";

  const notesHtml = s.internal_notes
    ? '<div class="section"><div class="section-title">Internal Notes</div><div class="notes">' + s.internal_notes + "</div></div>"
    : "";

  const priceSection = s.offered_price
    ? makeSection("Offered Price", [["Amount", "$" + s.offered_price.toLocaleString()]])
    : "";

  const groupedDocs: Record<string, string[]> = {};
  docs.forEach(d => {
    if (!groupedDocs[d.type]) groupedDocs[d.type] = [];
    groupedDocs[d.type].push(d.url);
  });
  const docsHtml = Object.keys(groupedDocs).length > 0
    ? Object.entries(groupedDocs).map(([type, urls]) => {
        const label = docTypeLabels[type] || type;
        const images = urls.map(u => {
          const isPdf = u.includes(".pdf");
          return isPdf
            ? '<p style="font-size:13px;color:#4a5568;">[PDF Document]</p>'
            : '<img class="doc-img" src="' + u + '" />';
        }).join("");
        return '<div class="doc-section"><div class="section"><div class="section-title">' + label + '</div>' + images + '</div></div>';
      }).join("")
    : "";

  const html = "<!DOCTYPE html><html><head><title>Submission Details</title><style>" + css + "</style></head><body>" +
    '<div class="header"><h1>' + (vehicleStr || "Submission Details") + "</h1>" +
    "<p>Submitted " + new Date(s.created_at).toLocaleDateString() + " &bull; " + (s.name || "Unknown") + "</p></div>" +
    '<div class="content">' +
    makeSection("Contact Information", [["Name", s.name], ["Phone", formatPhone(s.phone)], ["Email", s.email], ["ZIP", s.zip], ["Address", [s.address_street, s.address_city, s.address_state, s.zip].filter(Boolean).join(", ") || null]]) +
    makeSection("Vehicle Details", [
      ["Year/Make/Model", vehicleStr], ["VIN", s.vin], ["Plate", s.plate], ["Mileage", s.mileage],
      ["Exterior Color", s.exterior_color], ["Drivetrain", s.drivetrain], ["Modifications", s.modifications],
    ]) +
    makeSection("Condition & History", [
      ["Overall", s.overall_condition], ["Drivable", s.drivable],
      ["Exterior Damage", arrVal(s.exterior_damage)], ["Windshield", s.windshield_damage],
      ["Moonroof", s.moonroof], ["Interior Damage", arrVal(s.interior_damage)],
      ["Tech Issues", arrVal(s.tech_issues)], ["Engine Issues", arrVal(s.engine_issues)],
      ["Mechanical Issues", arrVal(s.mechanical_issues)], ["Accidents", s.accidents],
      ["Smoked In", s.smoked_in], ["Tires Replaced", s.tires_replaced], ["Keys", s.num_keys],
    ]) +
    makeSection("Loan & Info", [["Loan Status", s.loan_status], ["Next Step", s.next_step]]) +
    '<div class="section"><div class="section-title">Appointment</div><p style="font-size:13px;color:#4a5568;">' +
      (s.appointment_set && s.appointment_date
        ? new Date(s.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        : "No appointment yet") +
    '</p></div>' +
    '<div class="section"><div class="section-title">Acquisition Tracker</div>' + progressHtml + "</div>" +
    priceSection +
    notesHtml +
    photosHtml +
    docsHtml +
    '<div class="section"><div class="section-title">Customer Documents Upload Link</div>' +
    '<p style="font-size:13px;color:#4a5568;word-break:break-all;">' + docsUrl + "</p></div>" +
    "</div></body></html>";

  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return;
  waitAndPrint(printWindow, html);
}

// ── Print All Docs ──
export function printAllDocs(
  customerName: string | null,
  vehicleStr: string,
  docSections: { title: string; images: string[] }[],
) {
  const allEmpty = docSections.every(s => s.images.length === 0);
  if (allEmpty) return false;

  const css = basePrintCSS + "\n" + [
    ".header { background: #2a4365; color: white; padding: 24px 32px; text-align: center; }",
    ".header h1 { font-size: 22px; font-weight: 700; }",
    ".header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }",
    ".doc-section { page-break-before: always; padding: 24px 32px; }",
    ".doc-section:first-of-type { page-break-before: auto; }",
    ".doc-section h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; color: #2a4365; }",
    ".doc-img { max-width: 100%; margin-bottom: 16px; border: 1px solid #d1d5db; }",
    "@page { margin: 0.75in; size: letter; }",
  ].join("\n");

  const html = `<!DOCTYPE html><html><head><title>Customer Documents – ${customerName || vehicleStr}</title><style>${css}</style></head><body>
    <div class="header"><h1>Customer Documents</h1><p>${customerName || ""} — ${vehicleStr}</p></div>
    ${docSections.map(s => makeDocSection(s.title, s.images)).join("")}
  </body></html>`;

  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return false;
  waitAndPrint(printWindow, html);
  return true;
}

// ── Generate Check Request ──
export function printCheckRequest(
  s: PrintSubmission,
  logoBase64: string,
  docSections: { title: string; images: string[] }[],
) {
  const vehicleStr = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "N/A";
  const today = new Date().toLocaleDateString();

  const css = basePrintCSS + "\n" + [
    ".header { background: #2a4365; color: white; padding: 20px 32px; text-align: center; }",
    ".header img { height: 60px; margin: 0 auto 6px; display: block; }",
    ".header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }",
    ".content { padding: 24px 32px; }",
    ".title { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2px; }",
    "table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }",
    "th, td { padding: 10px 14px; text-align: left; border: 1px solid #d1d5db; font-size: 14px; }",
    "th { background: #f3f5f7; font-weight: 600; color: #4a5568; width: 40%; }",
    "td { font-weight: 500; }",
    ".amount { font-size: 22px; font-weight: 700; color: #2a4365; }",
    ".acv { font-size: 18px; font-weight: 600; color: #4a5568; }",
    ".sig-section { margin-top: 40px; display: flex; justify-content: space-between; }",
    ".sig-line { width: 45%; border-top: 1px solid #1a2a3a; padding-top: 6px; font-size: 12px; color: #6b7b8d; }",
    ".doc-section { page-break-before: always; padding: 24px 32px; }",
    ".doc-section h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; color: #2a4365; }",
    ".doc-img { max-width: 100%; margin-bottom: 16px; border: 1px solid #d1d5db; }",
    "@page { margin: 0.75in; size: letter; }",
  ].join("\n");

  const html = `<!DOCTYPE html><html><head><title>Check Request</title><style>${css}</style></head><body>
    <div class="header">${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : `<h1 style="font-size:22px;font-weight:700;">Harte Auto Group</h1>`}<p>Check Request Form</p></div>
    <div class="content">
      <p class="title">Check Request</p>
      <table>
        <tr><th>Date</th><td>${today}</td></tr>
        <tr><th>Customer Name (As It Appears on Title)</th><td>${s.name || ""}</td></tr>
        <tr><th>Address</th><td>${[s.address_street, s.address_city, s.address_state, s.zip].filter(Boolean).join(", ")}</td></tr>
        <tr><th>City, State, Zip</th><td>${[s.address_city, s.address_state, s.zip].filter(Boolean).join(", ") || ""}</td></tr>
        <tr><th>Contact Phone</th><td>${formatPhone(s.phone)}</td></tr>
        <tr><th>Contact Email</th><td>${s.email || ""}</td></tr>
        <tr><th>Agreed Upon Value (Check Amount)</th><td class="amount">$${s.offered_price!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
        <tr><th>In-House ACV (Actual Cash Value)</th><td class="acv">${s.acv_value ? "$" + s.acv_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}</td></tr>
        <tr><th>Description</th><td style="font-weight:600;">Customer Direct Inventory Purchase</td></tr>
        <tr><th>Vehicle</th><td>${vehicleStr}</td></tr>
        <tr><th>VIN</th><td>${s.vin || "N/A"}</td></tr>
        <tr><th>Mileage</th><td>${s.mileage || "N/A"}</td></tr>
      </table>
      <div class="sig-section">
        <div class="sig-line">GSM / GM Signature</div>
        <div class="sig-line">Date</div>
      </div>
      <div class="sig-section" style="margin-top:30px;">
        <div class="sig-line">Accounting Use – Check #</div>
        <div class="sig-line">Date Issued</div>
      </div>
    </div>
    ${docSections.map(s => makeDocSection(s.title, s.images)).join("")}
  </body></html>`;

  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return;
  waitAndPrint(printWindow, html);

  // Return the HTML for saving
  return html;
}
