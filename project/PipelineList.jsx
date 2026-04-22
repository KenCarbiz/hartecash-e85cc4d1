// PipelineList.jsx — mock admin pipeline table with "eye" icon to open
// the redesigned Customer File slide-out.

const { useState } = React;

function PipelineList({ submissions, onView }) {
  const statusPill = (s) => {
    const meta = window.STATUS_META[s] || { label: s, tone: "slate" };
    const tone = {
      green: "bg-emerald-100 text-emerald-800",
      blue:  "bg-sky-100 text-sky-800",
      amber: "bg-amber-100 text-amber-800",
      red:   "bg-red-100 text-red-800",
      slate: "bg-slate-100 text-slate-700",
    }[meta.tone];
    return <span className={`inline-flex items-center text-[11px] font-semibold rounded-md px-2 py-0.5 ${tone}`}>{meta.label}</span>;
  };
  const intentDot = (intent) => {
    const color = {
      sell: "bg-emerald-500",
      trade: "bg-sky-500",
      unsure: "bg-amber-500",
    }[intent] || "bg-slate-400";
    return <span className={`w-1.5 h-1.5 rounded-full ${color} inline-block`} />;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
        <div>
          <h2 className="font-display text-[20px] text-slate-900 leading-none">Pipeline</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{submissions.length} active customers</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a7 7 0 104.9 12l3.6 3.6a1 1 0 001.4-1.4L15.3 12.6A7 7 0 009 2zm0 2a5 5 0 110 10 5 5 0 010-10z"/>
            </svg>
            <input
              placeholder="Search name, VIN, phone…"
              className="h-8 pl-8 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 w-64"
            />
          </div>
          <button className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold hover:bg-slate-50">Filter</button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-semibold">
          <tr>
            <th className="text-left px-5 py-2.5 font-semibold">Customer</th>
            <th className="text-left px-3 py-2.5 font-semibold">Vehicle</th>
            <th className="text-left px-3 py-2.5 font-semibold">Intent</th>
            <th className="text-right px-3 py-2.5 font-semibold">Offer</th>
            <th className="text-left px-3 py-2.5 font-semibold">Status</th>
            <th className="text-right px-5 py-2.5 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition">
              <td className="px-5 py-3">
                <div className="font-semibold text-slate-900">{s.name}</div>
                <div className="text-[12px] text-slate-500">{s.phone}</div>
              </td>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-800">{s.vehicle_year} {s.vehicle_make} {s.vehicle_model}</div>
                <div className="text-[11px] text-slate-500 font-mono">{s.vin}</div>
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 capitalize">
                  {intentDot(s.intent)}{s.intent}
                </span>
              </td>
              <td className="px-3 py-3 text-right">
                {s.offered_price != null
                  ? <span className="font-bold text-slate-900">${s.offered_price.toLocaleString()}</span>
                  : s.estimated_offer_high != null
                    ? <span className="text-slate-500">~${s.estimated_offer_high.toLocaleString()}</span>
                    : <span className="text-slate-400">—</span>}
              </td>
              <td className="px-3 py-3">{statusPill(s.progress_status)}</td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => onView(s)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 text-[12px] font-semibold text-slate-700 transition"
                  title="Open customer file"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 4c-4 0-7.3 2.6-8.9 6a1 1 0 000 .9C2.7 14.4 6 17 10 17s7.3-2.6 8.9-6a1 1 0 000-.9C17.3 6.6 14 4 10 4zm0 2c2.8 0 5.2 1.7 6.7 4.5-1.5 2.8-3.9 4.5-6.7 4.5s-5.2-1.7-6.7-4.5C4.8 7.7 7.2 6 10 6zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/>
                  </svg>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

window.PipelineList = PipelineList;
