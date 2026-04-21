<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoCurb — Customer File Redesign</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
            display: ['"DM Serif Display"', 'Georgia', 'serif'],
          },
        },
      },
    };
  </script>
  <style>
    body { font-family: 'Inter', sans-serif; }
    .font-display { font-family: 'DM Serif Display', Georgia, serif; }

    /* Slide-in animation for the customer file sheet */
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .sheet-enter    { animation: slideIn 280ms cubic-bezier(0.32, 0.72, 0, 1); }
    .overlay-enter  { animation: fadeIn 280ms ease-out; }

    /* Tweaks panel styling */
    .tweaks-panel {
      box-shadow: 0 20px 60px -10px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body class="bg-slate-100">

  <!-- Single mount: AdminShell + pipeline + slide-out all render here -->
  <div id="app-root"></div>

  <!-- Tweaks panel mount -->
  <div id="tweaks-root"></div>

  <!-- React + Babel -->
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>

  <script src="mock-data.js"></script>
  <script type="text/babel" src="AdminShell.jsx"></script>
  <script type="text/babel" src="CustomerFile.jsx"></script>
  <script type="text/babel" src="PipelineList.jsx"></script>

  <script type="text/babel">
    const { useState, useEffect } = React;

    // Tweaks defaults — wrapped in editmode markers so host can persist.
    const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
      "headerStyle": "blue-gradient",
      "denseMode": false,
      "showHotLeadBadge": true,
      "sampleIndex": 0
    }/*EDITMODE-END*/;

    function App() {
      const [selected, setSelected] = useState(null);
      // Persist last-open submission across refresh (as per design guidelines)
      useEffect(() => {
        const savedId = localStorage.getItem("cf_open_id");
        if (savedId) {
          const s = window.MOCK_SUBMISSIONS.find(x => x.id === savedId);
          if (s) setSelected(s);
        }
      }, []);
      useEffect(() => {
        if (selected) localStorage.setItem("cf_open_id", selected.id);
        else localStorage.removeItem("cf_open_id");
      }, [selected]);

      // Close on escape
      useEffect(() => {
        const handler = (e) => { if (e.key === "Escape") setSelected(null); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
      }, []);

      // Slide-out lives OVER the content area only — sidebar stays
      // reachable because the overlay is prop-passed into <main>, not
      // a window-level `fixed inset-0`.
      const overlay = selected ? (
        <div
          className="absolute inset-0 z-40 flex justify-end overlay-enter"
          style={{ background: "rgba(15, 23, 42, 0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="w-full max-w-[1180px] h-full bg-slate-50 shadow-2xl sheet-enter overflow-hidden flex flex-col">
            <window.CustomerFile sub={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      ) : null;

      return (
        <window.AdminShell overlay={overlay}>
          <div className="px-6 py-6 max-w-[1500px] mx-auto">
            <div className="mb-5">
              <h1 className="font-display text-[28px] text-slate-900 leading-none">Customer Pipeline</h1>
              <p className="text-sm text-slate-500 mt-1">Click the eye icon to open a customer's file.</p>
            </div>
            <window.PipelineList submissions={window.MOCK_SUBMISSIONS} onView={setSelected} />
          </div>
        </window.AdminShell>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById("app-root"));
    root.render(<App />);

    // ─── Tweaks wiring ─────────────────────────────────────────────
    function TweaksPanel({ onClose }) {
      const [vals, setVals] = useState(TWEAK_DEFAULTS);

      const update = (k, v) => {
        const next = { ...vals, [k]: v };
        setVals(next);
        window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
        applyTweaks(next);
      };

      return (
        <div className="fixed bottom-5 right-5 z-[60] w-80 bg-white rounded-xl border border-slate-200 tweaks-panel overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <span className="font-display text-base">Tweaks</span>
            <button onClick={onClose} className="text-white/60 hover:text-white text-xs">Hide</button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block mb-1.5">Open Sample Customer</label>
              <select
                className="w-full h-9 text-sm rounded-lg border border-slate-200 px-2"
                value={vals.sampleIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  update("sampleIndex", idx);
                  document.dispatchEvent(new CustomEvent("cf-open-sample", { detail: idx }));
                }}
              >
                {window.MOCK_SUBMISSIONS.map((s, i) => (
                  <option key={s.id} value={i}>{s.name} · {s.vehicle_make} {s.vehicle_model}</option>
                ))}
              </select>
              <button
                className="w-full mt-2 h-9 rounded-lg bg-[#003b80] text-white text-[12px] font-bold hover:bg-[#002a5c]"
                onClick={() => document.dispatchEvent(new CustomEvent("cf-open-sample", { detail: vals.sampleIndex }))}
              >
                Open File
              </button>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block mb-1.5">Header Style</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: "blue-gradient", label: "Blue Gradient" },
                  { key: "solid-navy",    label: "Solid Navy" },
                  { key: "flat-light",    label: "Flat Light" },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => update("headerStyle", opt.key)}
                    className={`h-8 rounded-md text-[11px] font-semibold border transition ${
                      vals.headerStyle === opt.key
                        ? "bg-[#003b80] text-white border-[#003b80]"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-slate-700">Show "Hot Lead" badge</label>
              <button
                onClick={() => update("showHotLeadBadge", !vals.showHotLeadBadge)}
                className={`w-10 h-6 rounded-full transition relative ${vals.showHotLeadBadge ? "bg-[#003b80]" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${vals.showHotLeadBadge ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-slate-700">Dense mode</label>
              <button
                onClick={() => update("denseMode", !vals.denseMode)}
                className={`w-10 h-6 rounded-full transition relative ${vals.denseMode ? "bg-[#003b80]" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${vals.denseMode ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    function applyTweaks(vals) {
      // Header style
      const header = document.querySelector("[data-customer-header]");
      if (header) {
        header.classList.remove("bg-gradient-to-r", "from-[#003b80]", "to-[#005bb5]", "bg-[#003b80]", "bg-slate-100", "text-white", "text-slate-900");
        if (vals.headerStyle === "blue-gradient") header.classList.add("bg-gradient-to-r", "from-[#003b80]", "to-[#005bb5]", "text-white");
        else if (vals.headerStyle === "solid-navy") header.classList.add("bg-[#003b80]", "text-white");
        else if (vals.headerStyle === "flat-light") header.classList.add("bg-slate-100", "text-slate-900");
      }
    }

    const tweaksRoot = ReactDOM.createRoot(document.getElementById("tweaks-root"));
    let tweaksShown = false;
    function renderTweaks(shown) {
      tweaksShown = shown;
      tweaksRoot.render(shown ? <TweaksPanel onClose={() => renderTweaks(false)} /> : null);
    }

    // Custom event from Tweaks panel to open the selected sample
    document.addEventListener("cf-open-sample", (e) => {
      const idx = e.detail;
      const sub = window.MOCK_SUBMISSIONS[idx];
      if (sub) {
        // We don't have direct access to the App's setSelected, so simulate by
        // mounting via localStorage + a small hack: re-render root.
        localStorage.setItem("cf_open_id", sub.id);
        root.render(<App />);
      }
    });

    // ─── Edit mode protocol ────────────────────────────────────────
    window.addEventListener("message", (e) => {
      if (e.data?.type === "__activate_edit_mode")   renderTweaks(true);
      if (e.data?.type === "__deactivate_edit_mode") renderTweaks(false);
    });
    window.parent?.postMessage({ type: "__edit_mode_available" }, "*");
  </script>
</body>
</html>
