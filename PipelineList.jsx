/**
 * CustomerFile.jsx — redesigned slide-out for sales managers & salespeople.
 *
 * Key differences vs. original SubmissionDetailSheet:
 *  - Blue header bar leads with YEAR • MAKE • MODEL and the VIN
 *  - Offer / Deal Value is the biggest number on the screen
 *  - Customer info + car info are the primary rails
 *  - From the appraisal we ONLY expose: condition summary + tires/brakes pass-fail
 *  - Photos: one at a glance w/ inline flip through arrows (no modal)
 *  - Driver's License: thumbnail at a glance, click to expand inline
 *  - Full appraisal lives behind "Open Appraisal Tool" (only used when
 *    customer didn't accept and a manual appraisal is required)
 */

const { useState, useMemo } = React;

// ── tiny presentational helpers ──────────────────────────────────────
// Badge styling — `onDark` variants go in the blue header (need white
// text / saturated fills to stay readable); regular variants go on white
// body cards.
const statusBadgeClass = (tone, onDark = false) => {
  if (onDark) {
    switch (tone) {
      case "green": return "bg-emerald-400/25 text-emerald-100 border-emerald-300/40";
      case "blue":  return "bg-sky-400/25 text-sky-100 border-sky-300/40";
      case "amber": return "bg-amber-400/25 text-amber-100 border-amber-300/40";
      case "red":   return "bg-red-400/25 text-red-100 border-red-300/40";
      default:      return "bg-white/15 text-white border-white/25";
    }
  }
  switch (tone) {
    case "green": return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "blue":  return "bg-sky-500/15 text-sky-700 border-sky-500/30";
    case "amber": return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "red":   return "bg-red-500/15 text-red-700 border-red-500/30";
    default:      return "bg-slate-500/15 text-slate-700 border-slate-500/30";
  }
};

const intentMeta = {
  sell:   { label: "Selling",     sub: "Wants cash for the car",  color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20", onDark: "bg-emerald-400/25 text-emerald-100 border-emerald-300/40" },
  trade:  { label: "Trade-In",    sub: "Buying another car here", color: "text-sky-700 bg-sky-500/10 border-sky-500/20",           onDark: "bg-sky-400/25 text-sky-100 border-sky-300/40" },
  unsure: { label: "Undecided",   sub: "Open to sell or trade",   color: "text-amber-700 bg-amber-500/10 border-amber-500/20",     onDark: "bg-amber-400/25 text-amber-100 border-amber-300/40" },
};

// Section card — simple, quiet, no gradients.
function Card({ title, right, children, className = "", dense = false }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.1em]">{title}</h3>
        {right}
      </header>
      <div className={dense ? "p-3" : "p-4"}>{children}</div>
    </section>
  );
}

// Name/value row — label left, value right. Skips entirely if value falsy.
function Row({ label, value, mono = false }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className={`text-[13px] font-semibold text-slate-900 text-right ${mono ? "font-mono text-[12.5px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// Pass/Fail chip used ONLY for tires + brakes.
function PassFail({ label, pass }) {
  if (pass == null) {
    return (
      <div className="flex-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
        <div className="text-sm font-bold text-slate-400 mt-0.5">Not inspected</div>
      </div>
    );
  }
  const ok = pass === true;
  return (
    <div className={`flex-1 rounded-lg border px-3 py-2.5 ${
      ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
    }`}>
      <div className={`text-[11px] uppercase tracking-wider font-semibold ${ok ? "text-emerald-700" : "text-red-700"}`}>{label}</div>
      <div className={`text-sm font-bold mt-0.5 flex items-center gap-1.5 ${ok ? "text-emerald-800" : "text-red-800"}`}>
        {ok ? (
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"/></svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 110-16 8 8 0 010 16zM8.7 10L6.3 7.7a1 1 0 011.4-1.4L10 8.6l2.3-2.3a1 1 0 011.4 1.4L11.4 10l2.3 2.3a1 1 0 01-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 10z"/></svg>
        )}
        {ok ? "Pass" : "Needs Attention"}
      </div>
    </div>
  );
}

// Photo carousel — inline, no modal.
function PhotoCarousel({ photos = [] }) {
  const [i, setI] = useState(0);
  if (!photos.length) {
    return (
      <div className="aspect-[16/10] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
        No photos uploaded
      </div>
    );
  }
  const prev = () => setI((v) => (v - 1 + photos.length) % photos.length);
  const next = () => setI((v) => (v + 1) % photos.length);
  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-slate-900 group">
        <img src={photos[i]} alt={`Vehicle photo ${i + 1}`} className="w-full h-full object-cover" />
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/75 transition"
              aria-label="Previous photo"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z"/></svg>
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/75 transition"
              aria-label="Next photo"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z"/></svg>
            </button>
          </>
        )}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-semibold backdrop-blur-sm">
          {i + 1} / {photos.length}
        </div>
      </div>
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {photos.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition ${
                idx === i ? "border-blue-600 ring-2 ring-blue-200" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={p} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// DL thumbnail — small at glance, click to toggle full size inline.
function DLAtGlance({ src }) {
  const [open, setOpen] = useState(false);
  if (!src) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
        <div className="w-14 h-9 rounded bg-slate-200 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z"/></svg>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Driver's License</div>
          <div className="text-xs text-slate-500">Not uploaded</div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition text-left"
      >
        <div className="w-14 h-9 rounded overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
          <img src={src} alt="Driver's license" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Driver's License</div>
          <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"/></svg>
            Verified on file
          </div>
        </div>
        <span className="text-xs text-blue-700 font-semibold">{open ? "Hide" : "View"}</span>
      </button>
      {open && (
        <div className="p-3 pt-0">
          <img src={src} alt="Driver's license full" className="w-full rounded-md border border-slate-200" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// QR MODAL — shown when the customer arrives.
// The sales manager taps "Send QR to My Phone" and gets a QR code
// that opens the mobile inspection checkin on their phone/iPad,
// pre-scoped to this customer's token. They walk out to the car
// with the inspection ready to go.
// ─────────────────────────────────────────────────────────────────
function QRInspectionModal({ open, onClose, sub }) {
  if (!open) return null;

  // Two URLs they might want — the inspection app (internal, for staff
  // phones/iPads) and the customer checkin landing (what the customer
  // would hit if they scanned their own copy).
  const inspectionUrl = `https://app.autocurb.io/inspect/${sub.token}`;
  const checkinUrl    = `https://autocurb.io/c/${sub.token}`;

  // Build a QR using the public QR Server API — works offline in this
  // mock because it's a real URL, in prod we'd use a local lib.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&ecc=M&data=${encodeURIComponent(inspectionUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — blue bar matching the customer file */}
        <div className="bg-gradient-to-r from-[#003b80] to-[#005bb5] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">Walk to the Car</div>
            <div className="font-display text-[20px] leading-tight mt-0.5">Scan to open on your phone</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label="Close">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 4.9a1 1 0 011.4 0L10 7.2l2.3-2.3a1 1 0 011.4 1.4L11.4 8.6l2.3 2.3a1 1 0 01-1.4 1.4L10 10l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 8.6 6.3 6.3a1 1 0 010-1.4z"/></svg>
          </button>
        </div>

        {/* Customer summary strip */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#003b80] text-white text-[13px] font-bold flex items-center justify-center">
            {sub.name.split(" ").map(p => p[0]).slice(0,2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-slate-900 truncate">{sub.name}</div>
            <div className="text-[12px] text-slate-500 truncate">{sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Stall</div>
            <div className="text-[13px] font-bold text-slate-900">Service Bay</div>
          </div>
        </div>

        {/* QR code */}
        <div className="p-6 flex flex-col items-center">
          <div className="relative p-4 bg-white rounded-xl border-2 border-slate-200">
            <img src={qrSrc} alt="QR code to open inspection on phone" className="w-[260px] h-[260px] block" />
            {/* center AutoCurb badge */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-lg bg-white border-2 border-white shadow flex items-center justify-center">
                <div className="w-10 h-10 rounded-md bg-[#003b80] text-white text-[10px] font-black flex items-center justify-center tracking-tight">AC</div>
              </div>
            </div>
          </div>
          <p className="text-[12.5px] text-slate-500 mt-4 text-center max-w-[320px] leading-snug">
            Point your phone or iPad camera at the code. The inspection will open
            pre-loaded with <span className="font-semibold text-slate-700">{sub.name}</span>'s car.
          </p>
        </div>

        {/* Alternate actions */}
        <div className="px-5 pb-5 space-y-2">
          <button className="w-full h-11 rounded-lg bg-[#003b80] hover:bg-[#002a5c] text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 transition">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z"/></svg>
            Text Link to My Phone
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button className="h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12.5px] font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 transition">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm5 12h2a1 1 0 100-2H9a1 1 0 100 2z"/></svg>
              Open on This iPad
            </button>
            <button className="h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12.5px] font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 transition">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a1 1 0 011 1v1.06A7.01 7.01 0 0115.94 11H17a1 1 0 110 2h-1.06A7.01 7.01 0 019 17.94V19a1 1 0 11-2 0v-1.06A7.01 7.01 0 01.06 11H-1a1 1 0 01-1-1 1 1 0 011-1h1.06A7.01 7.01 0 017 4.06V3a1 1 0 011-1zm1 4.07A5.01 5.01 0 004.07 11H5a1 1 0 110 2h-.93A5.01 5.01 0 009 15.93V15a1 1 0 112 0v.93A5.01 5.01 0 0013.93 13H13a1 1 0 110-2h.93A5.01 5.01 0 009 6.07V7a1 1 0 11-2 0V6.07z"/></svg>
              Print Sticker
            </button>
          </div>
          <div className="mt-2 pt-3 border-t border-slate-100">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Short Link</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-[11.5px] text-slate-700 bg-slate-100 rounded px-2 py-1.5 truncate">{inspectionUrl.replace("https://","")}</code>
              <button className="h-7 px-2.5 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700">Copy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Formatter
const fmtMoney = (n, big = false) => {
  if (n == null) return "—";
  return big
    ? `$${Math.floor(n).toLocaleString()}`
    : `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const fmtNumber = (n) => (n == null ? "—" : n.toLocaleString());
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 60000; // min
  // For the mock, if future or sentinel, just say "just now"
  if (diff < 1) return "just now";
  if (diff < 60) return `${Math.round(diff)} min ago`;
  const h = Math.round(diff / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(iso);
};

// ──────────────────────────────────────────────────────────────────────
// Main component — Customer File slide-out
// ──────────────────────────────────────────────────────────────────────
function CustomerFile({ sub, onClose }) {
  const meta = window.STATUS_META[sub.progress_status] || { label: sub.progress_status, tone: "slate" };
  const intent = intentMeta[sub.intent] || intentMeta.unsure;
  const [qrOpen, setQrOpen] = useState(false);

  // Customer has physically arrived for their inspection — this unlocks
  // the "walk to the car" flow with QR handoff to phone/iPad.
  const customerArrived = sub.progress_status === "customer_arrived";

  // "Inspection needed / manual appraisal" mode:
  // customer didn't accept AND inspection not yet done (or no offer).
  const manualAppraisalNeeded = !sub.offer_accepted && !sub.inspection_completed;

  // Deal value — prefer offered_price, fall back to estimate.
  const dealValue = sub.offered_price ?? sub.estimated_offer_high;
  const dealKind = sub.offered_price != null ? "Offer Given" : "Estimated Offer";

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* BLUE HEADER BAR — Year/Make/Model + VIN up top, per request    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <header className="shrink-0 bg-gradient-to-r from-[#003b80] to-[#005bb5] text-white">
        <div className="px-6 pt-4 pb-5">
          {/* Top row: close + quick actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 4.9a1 1 0 011.4 0L10 7.2l2.3-2.3a1 1 0 011.4 1.4L11.4 8.6l2.3 2.3a1 1 0 01-1.4 1.4L10 10l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 8.6 6.3 6.3a1 1 0 010-1.4z"/></svg>
              </button>
              <span className="text-white/70 text-xs">Customer File</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-semibold flex items-center gap-1.5 transition">
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h3.5a1 1 0 01.9.55l.7 1.4H17a1 1 0 011 1V16a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/></svg>
                Notes
              </button>
              <button className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-semibold flex items-center gap-1.5 transition">
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 00-2 2v1h14V6a2 2 0 00-2-2H5zM17 9H3v5a2 2 0 002 2h10a2 2 0 002-2V9z"/></svg>
                Print
              </button>
              {manualAppraisalNeeded && (
                <button className="px-3 h-8 rounded-lg bg-white text-[#003b80] hover:bg-white/90 text-[12px] font-bold flex items-center gap-1.5 transition">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a.5.5 0 01.5.5v5.5H16a.5.5 0 010 1h-5.5V16a.5.5 0 01-1 0v-5.5H4a.5.5 0 010-1h5.5V4a.5.5 0 01.5-.5z"/></svg>
                  Open Appraisal
                </button>
              )}
            </div>
          </div>

          {/* Vehicle — HUGE year/make/model */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <div className="text-[11px] uppercase tracking-[0.15em] text-white/60 font-semibold mb-1">
                {sub.vehicle_year} · {fmtNumber(sub.mileage)} mi
              </div>
              <h1 className="font-display text-[34px] leading-[1.05] tracking-tight">
                {sub.vehicle_make} {sub.vehicle_model}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-[13px] text-white/80">
                <span className="font-mono bg-white/10 rounded px-2 py-0.5 tracking-wider">{sub.vin}</span>
                {sub.plate && <span>Plate · {sub.plate}</span>}
                {sub.exterior_color && <span className="text-white/60">·  {sub.exterior_color}</span>}
              </div>
            </div>

            {/* Big offer number */}
            {dealValue != null && (
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.15em] text-white/60 font-semibold">{dealKind}</div>
                <div className="font-display text-[44px] leading-none tracking-tight mt-0.5">
                  {fmtMoney(dealValue, true)}
                </div>
                {sub.acv_value != null && (
                  <div className="text-[11px] text-white/60 mt-1">
                    ACV {fmtMoney(sub.acv_value)}
                    {sub.offered_price && (
                      <span className={`ml-2 font-semibold ${sub.offered_price > sub.acv_value ? "text-emerald-300" : "text-red-300"}`}>
                        {sub.offered_price > sub.acv_value ? "+" : ""}{fmtMoney(sub.offered_price - sub.acv_value)} spread
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status chips row */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 border whitespace-nowrap ${statusBadgeClass(meta.tone, true)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {meta.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 border whitespace-nowrap ${intent.onDark}`}>
              {intent.label}
            </span>
            {sub.is_hot_lead && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-orange-400/25 text-orange-100 border border-orange-300/50 whitespace-nowrap">
                🔥 Hot Lead
              </span>
            )}
            <span className="text-[11px] text-white/60 ml-auto">
              Submitted {fmtDate(sub.created_at)}
            </span>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────── */}
        {/* ARRIVAL STRIP — only when customer has physically arrived.  */}
        {/* Urgent, unmissable. Primary CTA = QR handoff to phone.     */}
        {/* ───────────────────────────────────────────────────────── */}
        {customerArrived && (
          <div className="bg-gradient-to-r from-red-600 to-red-500 border-t border-red-800/30">
            <div className="px-6 py-3 flex items-center gap-4 flex-wrap">
              {/* Pulsing indicator */}
              <div className="relative flex items-center justify-center shrink-0">
                <span className="absolute inline-flex h-3 w-3 rounded-full bg-white/60 animate-ping" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/80">Customer Is Here Now</div>
                <div className="text-[15px] font-bold text-white leading-tight">
                  {sub.name.split(" ")[0]} arrived {sub.arrived_at ? timeAgo(sub.arrived_at) : "moments ago"} · Car in Service Bay
                </div>
              </div>
              <button
                onClick={() => setQrOpen(true)}
                className="h-10 px-4 rounded-lg bg-white text-red-700 text-[13px] font-bold inline-flex items-center justify-center gap-2 hover:bg-white/95 transition shadow-lg shadow-red-900/20"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 3h5v5H3V3zm1 1v3h3V4H4zm8-1h5v5h-5V3zm1 1v3h3V4h-3zM3 12h5v5H3v-5zm1 1v3h3v-3H4zm8-1h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z"/>
                </svg>
                Send QR to My Phone
              </button>
              <button className="h-10 px-4 rounded-lg bg-red-800/30 hover:bg-red-800/50 text-white text-[13px] font-bold inline-flex items-center gap-1.5 transition border border-white/20">
                Open on iPad
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z"/></svg>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* BODY — two columns: primary rail + supporting                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 max-w-[1400px] mx-auto">

          {/* LEFT / PRIMARY */}
          <div className="space-y-5 min-w-0">

            {/* Photos at-a-glance + DL at-a-glance */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
              <Card title="Vehicle Photos" right={
                <span className="text-[11px] text-slate-500">{sub.photos.length} photo{sub.photos.length === 1 ? "" : "s"}</span>
              }>
                <PhotoCarousel photos={sub.photos} />
              </Card>

              <div className="space-y-4">
                <Card title="ID" dense>
                  <DLAtGlance src={sub.dl_thumb} />
                </Card>
                <Card title="Intent" dense>
                  <div className="px-1 py-1">
                    <div className="text-base font-bold text-slate-900">{intent.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{intent.sub}</div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Customer + Vehicle details side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card title="Customer">
                <div className="space-y-0">
                  <Row label="Name" value={sub.name} />
                  <Row label="Phone" value={
                    sub.phone ? (
                      <a href={`tel:${sub.phone}`} className="text-blue-700 hover:underline">{sub.phone}</a>
                    ) : null
                  } />
                  <Row label="Email" value={
                    sub.email ? (
                      <a href={`mailto:${sub.email}`} className="text-blue-700 hover:underline">{sub.email}</a>
                    ) : null
                  } />
                  <Row label="Address" value={
                    sub.address_street ? (
                      <span>
                        {sub.address_street}<br/>
                        <span className="text-slate-600 font-normal">
                          {sub.address_city}, {sub.address_state} {sub.zip}
                        </span>
                      </span>
                    ) : sub.zip
                  } />
                </div>
              </Card>

              <Card title="Vehicle">
                <div className="space-y-0">
                  <Row label="Year" value={sub.vehicle_year} />
                  <Row label="Make / Model" value={`${sub.vehicle_make} ${sub.vehicle_model}`} />
                  <Row label="VIN" value={sub.vin} mono />
                  <Row label="Plate" value={sub.plate} />
                  <Row label="Mileage" value={`${fmtNumber(sub.mileage)} mi`} />
                  <Row label="Color" value={sub.exterior_color} />
                  <Row label="Drivable" value={sub.drivable} />
                </div>
              </Card>
            </div>

            {/* Inspection — ONLY condition summary + tires/brakes pass/fail.
                Full appraisal hidden behind "Open Appraisal Tool". */}
            <Card
              title={sub.inspection_completed ? "Inspection Summary" : customerArrived ? "Inspection · Customer Here" : "Inspection"}
              right={
                sub.inspection_completed ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5">Completed</span>
                ) : customerArrived ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-700 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-0.5">
                    <span className="relative flex items-center justify-center">
                      <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-red-500 opacity-60 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
                    </span>
                    Ready to Start
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5">Pending</span>
                )
              }
            >
              {sub.inspection_completed ? (
                <div className="space-y-4">
                  {/* Condition — one line, no arrays of damage codes */}
                  {sub.condition_summary && (
                    <p className="text-[14px] leading-relaxed text-slate-700">{sub.condition_summary}</p>
                  )}
                  {/* Tires + Brakes pass/fail */}
                  <div className="flex gap-3">
                    <PassFail label="Tires" pass={sub.tires_pass} />
                    <PassFail label="Brakes" pass={sub.brakes_pass} />
                  </div>
                  {/* Contextual buttons: full report always; Appraise only if
                      customer didn't accept the auto-offer and we need a
                      manual appraisal. */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 inline-flex items-center gap-1.5 transition">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4a2 2 0 012-2h9l5 5v9a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/></svg>
                      View Full Inspection
                    </button>
                    {manualAppraisalNeeded ? (
                      <button className="h-9 px-3.5 rounded-lg bg-[#003b80] hover:bg-[#002a5c] text-white text-[12px] font-bold inline-flex items-center gap-1.5 transition">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a7 7 0 100 14 7 7 0 000-14zm0 3a1 1 0 011 1v3h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H7a1 1 0 110-2h2V7a1 1 0 011-1z"/></svg>
                        Appraise Vehicle
                      </button>
                    ) : (
                      <button className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition">
                        Re-Appraise
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {customerArrived ? (
                    <>
                      <div className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 border border-red-300 p-4">
                        <div className="flex items-start gap-3">
                          <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                            <span className="absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-60 animate-ping" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-red-900 text-sm">Customer is at the car</div>
                            <div className="text-[13px] text-red-800/90 mt-0.5 leading-snug">
                              Scan the QR on your phone or iPad and walk out to start the inspection.
                              Tires &amp; brakes will sync back here when you're done.
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setQrOpen(true)}
                        className="w-full h-11 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 transition shadow-sm"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 3h5v5H3V3zm1 1v3h3V4H4zm8-1h5v5h-5V3zm1 1v3h3V4h-3zM3 12h5v5H3v-5zm1 1v3h3v-3H4zm8-1h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z"/>
                        </svg>
                        Send QR to My Phone
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 transition">
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm5 12h2a1 1 0 100-2H9a1 1 0 100 2z"/></svg>
                          Open on iPad
                        </button>
                        <button className="h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 transition">
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.6l-6.3 6.3a1 1 0 101.4 1.4L15 6.4V9a1 1 0 102 0V4a1 1 0 00-1-1h-5zM5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 100-2H5z"/></svg>
                          Check-In Page
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 11.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM10 6a.75.75 0 00-.75.75v4a.75.75 0 001.5 0v-4A.75.75 0 0010 6z"/>
                        </svg>
                        <div className="flex-1">
                          <div className="font-semibold text-amber-900 text-sm">No inspection completed yet</div>
                          <div className="text-[13px] text-amber-800/80 mt-0.5">Tires and brakes pass/fail will appear here once the car is inspected.</div>
                        </div>
                      </div>
                      <button className="w-full h-10 rounded-lg bg-[#003b80] hover:bg-[#002a5c] text-white text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a1 1 0 011-1h10a1 1 0 011 1v14l-5-3-5 3-1-.6V3z"/></svg>
                        Start Inspection
                      </button>
                    </>
                  )}
                </div>
              )}
            </Card>

          </div>

          {/* RIGHT / SECONDARY rail */}
          <aside className="space-y-5 min-w-0">

            {/* Next Action — single, obvious CTA telling the salesperson
                what to do right now. Label + button change based on the
                state of the deal. */}
            {(() => {
              // Decide the single next action by walking the funnel.
              let nextLabel, nextSub, nextBtn, nextTone = "blue", nextOnClick = null;
              if (customerArrived) {
                nextLabel = "Walk to the Car";
                nextSub = `${sub.name.split(" ")[0]} is here. Scan the QR on your phone and start the inspection.`;
                nextBtn = "Send QR to My Phone";
                nextTone = "red";
                nextOnClick = () => setQrOpen(true);
              } else if (!sub.inspection_completed) {
                nextLabel = "Start Inspection";
                nextSub = "Walk the car — tires, brakes, photos, docs.";
                nextBtn = "Start Inspection";
              } else if (manualAppraisalNeeded) {
                nextLabel = "Appraise Vehicle";
                nextSub = "Customer declined auto-offer. Manual appraisal required.";
                nextBtn = "Open Appraisal";
                nextTone = "amber";
              } else if (sub.progress_status === "offer_sent" || sub.progress_status === "offer_pending") {
                nextLabel = "Review Offer";
                nextSub = "Customer has an offer. Follow up to close.";
                nextBtn = "Send Follow-Up";
                nextTone = "green";
              } else if (sub.progress_status === "inspection_scheduled") {
                nextLabel = "Inspection Scheduled";
                nextSub = "Customer is booked. Check in when they arrive.";
                nextBtn = "Check In Customer";
              } else {
                nextLabel = "Finalize Deal";
                nextSub = "Paperwork and check request.";
                nextBtn = "Open Check Request";
                nextTone = "green";
              }
              const toneBg = {
                blue:  "from-[#003b80] to-[#005bb5]",
                amber: "from-amber-600 to-amber-500",
                green: "from-emerald-700 to-emerald-600",
                red:   "from-red-600 to-red-500",
              }[nextTone];
              return (
                <section className={`rounded-xl border border-slate-200 bg-gradient-to-br ${toneBg} text-white shadow-sm overflow-hidden`}>
                  <div className="px-4 py-2.5 border-b border-white/15 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/80">Next Action</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 rounded px-2 py-0.5">For Sales</span>
                  </div>
                  <div className="p-4">
                    <div className="font-display text-[20px] leading-tight">{nextLabel}</div>
                    <p className="text-[12.5px] text-white/80 mt-1 leading-snug">{nextSub}</p>
                    <button
                      onClick={nextOnClick || undefined}
                      className="w-full mt-3 h-10 rounded-lg bg-white text-slate-900 text-[13px] font-bold hover:bg-white/90 transition inline-flex items-center justify-center gap-1.5"
                    >
                      {customerArrived && (
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M3 3h5v5H3V3zm1 1v3h3V4H4zm8-1h5v5h-5V3zm1 1v3h3V4h-3zM3 12h5v5H3v-5zm1 1v3h3v-3H4zm8-1h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z"/>
                        </svg>
                      )}
                      {nextBtn}
                      {!customerArrived && (
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z"/></svg>
                      )}
                    </button>
                    {customerArrived && (
                      <button className="w-full mt-2 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 text-white text-[12px] font-bold transition inline-flex items-center justify-center gap-1.5">
                        Open Customer Check-In Page
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.6l-6.3 6.3a1 1 0 101.4 1.4L15 6.4V9a1 1 0 102 0V4a1 1 0 00-1-1h-5zM5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 100-2H5z"/></svg>
                      </button>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* Deal status — compact summary with appointment */}
            <Card title="Deal Status">
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Current Step</div>
                  <div className={`text-sm font-bold mt-0.5 ${
                    meta.tone === "green" ? "text-emerald-700" :
                    meta.tone === "amber" ? "text-amber-700" :
                    meta.tone === "red"   ? "text-red-700" : "text-slate-900"
                  }`}>{meta.label}</div>
                </div>

                {sub.appointment_set && (
                  <div className="rounded-lg bg-sky-50 border border-sky-200 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-sky-700 font-semibold">Appointment</div>
                    <div className="text-sm font-bold text-sky-900 mt-0.5">
                      {new Date(sub.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {sub.appointment_time && <span className="text-sky-700"> · {sub.appointment_time}</span>}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button className="flex-1 h-9 rounded-lg bg-[#003b80] hover:bg-[#002a5c] text-white text-[12px] font-bold transition">Update Status</button>
                  <button className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold transition">Schedule</button>
                </div>
              </div>
            </Card>

            {/* Offer breakdown */}
            {dealValue != null && (
              <Card title="Offer Breakdown">
                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] text-slate-600">{dealKind}</span>
                    <span className="font-display text-[22px] text-slate-900 leading-none">{fmtMoney(dealValue, true)}</span>
                  </div>
                  {sub.acv_value != null && (
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-slate-600">ACV</span>
                      <span className="font-semibold text-slate-800">{fmtMoney(sub.acv_value)}</span>
                    </div>
                  )}
                  {sub.loan_payoff_amount != null && (
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-slate-600">Loan Payoff</span>
                      <span className="font-semibold text-slate-800">−{fmtMoney(sub.loan_payoff_amount)}</span>
                    </div>
                  )}
                  {sub.loan_payoff_amount != null && dealValue != null && (
                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                      <span className="text-[12px] uppercase tracking-wider text-slate-500 font-semibold">Customer Equity</span>
                      <span className={`font-bold text-[15px] ${
                        (dealValue - sub.loan_payoff_amount) >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}>
                        {(dealValue - sub.loan_payoff_amount) >= 0 ? "+" : ""}{fmtMoney(dealValue - sub.loan_payoff_amount)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Loan info — compact */}
            {(sub.loan_status || sub.loan_company) && (
              <Card title="Loan">
                <div className="space-y-0">
                  <Row label="Status" value={sub.loan_status} />
                  <Row label="Lender" value={sub.loan_company} />
                  <Row label="Balance" value={sub.loan_balance ? fmtMoney(sub.loan_balance) : null} />
                  <Row label="Verified Payoff" value={sub.loan_payoff_amount ? fmtMoney(sub.loan_payoff_amount) : null} />
                </div>
              </Card>
            )}

          </aside>
        </div>
      </div>

      {/* QR handoff modal */}
      <QRInspectionModal open={qrOpen} onClose={() => setQrOpen(false)} sub={sub} />
    </div>
  );
}

window.CustomerFile = CustomerFile;
