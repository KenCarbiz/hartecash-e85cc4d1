// @ts-nocheck
import { useState, useEffect } from "react";

// ─── SHOT MANIFEST ────────────────────────────────────────────────────────────
const ALL_SHOTS = [
  { id: "driver_side",      label: "Driver Side",            desc: "Step back — full bumper to bumper, wheels in frame",        orientation: "landscape" },
  { id: "passenger_side",   label: "Passenger Side",         desc: "Step back — full bumper to bumper, wheels in frame",        orientation: "landscape" },
  { id: "front",            label: "Front",                  desc: "Center front bumper, capture full width",                   orientation: "landscape" },
  { id: "rear",             label: "Rear",                   desc: "Center rear bumper, capture full width",                    orientation: "landscape" },
  { id: "driver_rocker",    label: "Driver Rocker Panel",    desc: "Crouch low — shoot along underside between wheels",         orientation: "landscape" },
  { id: "pass_rocker",      label: "Passenger Rocker Panel", desc: "Crouch low — shoot along underside between wheels",         orientation: "landscape" },
  { id: "wheel",            label: "Wheel / Tire",           desc: "Fill the frame with one wheel — check tread depth",        orientation: "any" },
  { id: "windshield",       label: "Windshield",             desc: "Stand at front corner — capture full glass, look for chips",orientation: "landscape" },
  { id: "hood",             label: "Engine Bay",             desc: "Open hood — capture full engine compartment",               orientation: "landscape" },
  { id: "trunk",            label: "Trunk / Cargo Area",     desc: "Open trunk/liftgate — shoot straight in from behind",      orientation: "landscape" },
  { id: "driver_door",      label: "Driver Door Interior",   desc: "Open door — shoot across front seat from outside",         orientation: "any" },
  { id: "dashboard",        label: "Dashboard & Odometer",   desc: "Capture full dash — odometer reading must be visible",     orientation: "landscape" },
  { id: "undercarriage",    label: "Wheel Well",             desc: "Crouch at corner — capture wheel well for rust",           orientation: "any" },
];

// ─── ARCHETYPE SHAPES ─────────────────────────────────────────────────────────
// vehicleType prop comes from Black Book VIN decode via parent component
const ARCHETYPE_SHAPES = {
  sedan:       { roofHeight: 0.38, roofStart: 0.26, roofEnd: 0.76, label: "Sedan" },
  compact_suv: { roofHeight: 0.30, roofStart: 0.18, roofEnd: 0.82, label: "Compact SUV" },
  midsize_suv: { roofHeight: 0.28, roofStart: 0.16, roofEnd: 0.84, label: "Midsize SUV" },
  large_suv:   { roofHeight: 0.25, roofStart: 0.14, roofEnd: 0.86, label: "Large SUV" },
  truck:       { roofHeight: 0.28, roofStart: 0.46, roofEnd: 0.88, label: "Truck", hasBed: true },
  van:         { roofHeight: 0.22, roofStart: 0.08, roofEnd: 0.92, label: "Van",   isVan: true },
};

const OVERLAY_COLORS = ["#00FF88", "#FF3B3B", "#FFFFFF"];

// ─── SILHOUETTE RENDERER ──────────────────────────────────────────────────────
function GhostCarSilhouette({ archetype, shot, color, W, H }) {
  const sw = 2.5;
  const sh = ARCHETYPE_SHAPES[archetype] || ARCHETYPE_SHAPES.sedan;

  if (shot === "driver_side" || shot === "passenger_side") {
    const bodyTop    = H * sh.roofHeight;
    const bodyBot    = H * 0.70;
    const wheelR     = H * 0.11;
    const frontWheel = W * 0.22;
    const rearWheel  = W * 0.78;

    if (sh.hasBed) return (
      <g stroke={color} strokeWidth={sw} fill="none">
        <rect x={W*.46} y={bodyTop} width={W*.42} height={bodyBot - bodyTop} rx="5"/>
        <path d={`M${W*.49},${bodyTop} L${W*.52},${H*.18} L${W*.86},${H*.18} L${W*.88},${bodyTop}`}/>
        <rect x={W*.07} y={H*.40} width={W*.38} height={bodyBot - H*.40} rx="3"/>
        <circle cx={W*.22} cy={H*.78} r={wheelR}/>
        <circle cx={W*.22} cy={H*.78} r={wheelR*.45}/>
        <circle cx={W*.78} cy={H*.78} r={wheelR}/>
        <circle cx={W*.78} cy={H*.78} r={wheelR*.45}/>
        <line x1={W*.44} y1={H*.40} x2={W*.44} y2={bodyBot} strokeWidth={1.5}/>
      </g>
    );

    if (sh.isVan) return (
      <g stroke={color} strokeWidth={sw} fill="none">
        <rect x={W*.07} y={bodyTop} width={W*.86} height={bodyBot - bodyTop} rx="5"/>
        <path d={`M${W*.07},${bodyTop + H*.06} L${W*.14},${bodyTop}`}/>
        <circle cx={frontWheel} cy={H*.78} r={wheelR}/>
        <circle cx={frontWheel} cy={H*.78} r={wheelR*.45}/>
        <circle cx={rearWheel}  cy={H*.78} r={wheelR}/>
        <circle cx={rearWheel}  cy={H*.78} r={wheelR*.45}/>
        <line x1={W*.38} y1={bodyTop} x2={W*.38} y2={bodyBot} strokeDasharray="5,3" strokeWidth={1.5}/>
        <line x1={W*.62} y1={bodyTop} x2={W*.62} y2={bodyBot} strokeDasharray="5,3" strokeWidth={1.5}/>
      </g>
    );

    return (
      <g stroke={color} strokeWidth={sw} fill="none">
        <rect x={W*.10} y={bodyTop} width={W*.80} height={bodyBot - bodyTop} rx="6"/>
        <path d={`M${W*sh.roofStart},${bodyTop} C${W*(sh.roofStart+.04)},${bodyTop} ${W*(sh.roofStart+.06)},${H*.18} ${W*.36},${H*.18} L${W*.68},${H*.18} C${W*.74},${H*.18} ${W*(sh.roofEnd-.04)},${bodyTop} ${W*sh.roofEnd},${bodyTop}`}/>
        <circle cx={frontWheel} cy={H*.78} r={wheelR}/>
        <circle cx={frontWheel} cy={H*.78} r={wheelR*.45}/>
        <circle cx={rearWheel}  cy={H*.78} r={wheelR}/>
        <circle cx={rearWheel}  cy={H*.78} r={wheelR*.45}/>
        <line x1={W*.46} y1={H*.18} x2={W*.46} y2={bodyTop} strokeDasharray="4,3" strokeWidth={1}/>
        <line x1={W*.56} y1={H*.18} x2={W*.56} y2={bodyTop} strokeDasharray="4,3" strokeWidth={1}/>
      </g>
    );
  }

  if (shot === "driver_rocker" || shot === "pass_rocker") return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <rect x={W*.28} y={H*.42} width={W*.44} height={H*.14} rx="4"/>
      <path d={`M${W*.10},${H*.56} L${W*.10},${H*.35} Q${W*.10},${H*.22} ${W*.22},${H*.22} Q${W*.34},${H*.22} ${W*.34},${H*.35} L${W*.34},${H*.42}`}/>
      <path d={`M${W*.90},${H*.56} L${W*.90},${H*.35} Q${W*.90},${H*.22} ${W*.78},${H*.22} Q${W*.66},${H*.22} ${W*.66},${H*.35} L${W*.66},${H*.42}`}/>
      <line x1={W*.08} y1={H*.56} x2={W*.92} y2={H*.56} strokeWidth={1.5}/>
      <path d={`M${W*.48},${H*.65} L${W*.50},${H*.72} L${W*.52},${H*.65}`} strokeWidth={1.5}/>
      <text x={W*.50} y={H*.82} textAnchor="middle" fill={color} fontSize={H*.055} fontFamily="Inter,sans-serif" stroke="none" opacity={.7}>AIM HERE</text>
    </g>
  );

  if (shot === "front" || shot === "rear") {
    const wide = archetype !== "sedan";
    const bL = W*(wide?.10:.15);
    const bW = W*(wide?.80:.70);
    return (
      <g stroke={color} strokeWidth={sw} fill="none">
        <rect x={bL} y={H*.22} width={bW} height={H*.46} rx="6"/>
        {archetype !== "van" && !sh.hasBed && (
          <path d={`M${bL+W*.06},${H*.22} L${bL+W*.10},${H*.10} L${bL+bW-W*.10},${H*.10} L${bL+bW-W*.06},${H*.22}`}/>
        )}
        <ellipse cx={W*.24} cy={H*.82} rx={W*.10} ry={H*.08}/>
        <ellipse cx={W*.24} cy={H*.82} rx={W*.05} ry={H*.04}/>
        <ellipse cx={W*.76} cy={H*.82} rx={W*.10} ry={H*.08}/>
        <ellipse cx={W*.76} cy={H*.82} rx={W*.05} ry={H*.04}/>
        <rect x={W*.36} y={H*.28} width={W*.28} height={H*.15} rx="3"/>
        <line x1={W*.50} y1={H*.22} x2={W*.50} y2={H*.68} strokeDasharray="5,4" strokeWidth={1}/>
      </g>
    );
  }

  if (shot === "windshield") return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <path d={`M${W*.16},${H*.72} L${W*.28},${H*.18} L${W*.72},${H*.18} L${W*.84},${H*.72} Z`}/>
      <line x1={W*.16} y1={H*.72} x2={W*.08} y2={H*.82} strokeWidth={sw}/>
      <line x1={W*.84} y1={H*.72} x2={W*.92} y2={H*.82} strokeWidth={sw}/>
      <path d={`M${W*.20},${H*.68} Q${W*.50},${H*.38} ${W*.80},${H*.68}`} strokeDasharray="6,4" strokeWidth={1.5}/>
      <rect x={W*.30} y={H*.28} width={W*.40} height={H*.32} rx="4" strokeDasharray="5,3" strokeWidth={1.5} opacity={.5}/>
      <text x={W*.50} y={H*.48} textAnchor="middle" fill={color} fontSize={H*.055} fontFamily="Inter,sans-serif" stroke="none" opacity={.6}>SCAN FOR CHIPS</text>
    </g>
  );

  if (shot === "wheel") {
    const r  = Math.min(W,H) * .36;
    const ri = r * .48;
    return (
      <g stroke={color} strokeWidth={sw} fill="none">
        <circle cx={W*.50} cy={H*.50} r={r}/>
        <circle cx={W*.50} cy={H*.50} r={ri}/>
        <circle cx={W*.50} cy={H*.50} r={r*.12} fill={color} opacity={.4}/>
        {[0,45,90,135,180,225,270,315].map(deg => {
          const rad = deg * Math.PI / 180;
          return <line key={deg}
            x1={W*.50 + Math.cos(rad)*r*.15} y1={H*.50 + Math.sin(rad)*r*.15}
            x2={W*.50 + Math.cos(rad)*ri*.95} y2={H*.50 + Math.sin(rad)*ri*.95}
            strokeWidth={sw*.8}/>;
        })}
        <line x1={W*.50-r} y1={H*.50+r*.70} x2={W*.50+r} y2={H*.50+r*.70} strokeWidth={1} strokeDasharray="3,3" opacity={.4}/>
        <text x={W*.50} y={H*.50+r*.85} textAnchor="middle" fill={color} fontSize={H*.045} fontFamily="Inter,sans-serif" stroke="none" opacity={.6}>CHECK TREAD</text>
      </g>
    );
  }

  if (shot === "hood") return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <rect x={W*.06} y={H*.10} width={W*.88} height={H*.78} rx="6"/>
      <rect x={W*.14} y={H*.18} width={W*.33} height={H*.30} rx="4"/>
      <rect x={W*.53} y={H*.18} width={W*.33} height={H*.30} rx="4"/>
      <rect x={W*.14} y={H*.55} width={W*.72} height={H*.24} rx="4"/>
      <line x1={W*.50} y1={H*.10} x2={W*.50} y2={H*.88} strokeDasharray="6,4" strokeWidth={1}/>
    </g>
  );

  if (shot === "trunk") return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <rect x={W*.06} y={H*.12} width={W*.88} height={H*.72} rx="6"/>
      <rect x={W*.16} y={H*.22} width={W*.68} height={H*.50} rx="4"/>
      <line x1={W*.50} y1={H*.12} x2={W*.50} y2={H*.84} strokeDasharray="6,4" strokeWidth={1}/>
      <path d={`M${W*.28},${H*.82} Q${W*.50},${H*.94} ${W*.72},${H*.82}`} fill="none"/>
    </g>
  );

  if (shot === "driver_door") return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <rect x={W*.05} y={H*.08} width={W*.90} height={H*.82} rx="6"/>
      <rect x={W*.13} y={H*.16} width={W*.74} height={H*.36} rx="4"/>
      <circle cx={W*.83} cy={H*.55} r={W*.025}/>
      <rect x={W*.13} y={H*.60} width={W*.28} height={H*.22} rx="3"/>
      <rect x={W*.59} y={H*.60} width={W*.28} height={H*.22} rx="3"/>
      <line x1={W*.05} y1={H*.56} x2={W*.95} y2={H*.56} strokeDasharray="4,3" strokeWidth={1}/>
      <line x1={W*.35} y1={H*.08} x2={W*.35} y2={H*.56} strokeDasharray="4,3" strokeWidth={1}/>
      <line x1={W*.65} y1={H*.08} x2={W*.65} y2={H*.56} strokeDasharray="4,3" strokeWidth={1}/>
    </g>
  );

  if (shot === "dashboard") return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <rect x={W*.03} y={H*.06} width={W*.94} height={H*.52} rx="8"/>
      <circle cx={W*.25} cy={H*.29} r={H*.16}/>
      <circle cx={W*.25} cy={H*.29} r={H*.04} fill={color}/>
      <line x1={W*.25} y1={H*.29} x2={W*.34} y2={H*.17} strokeWidth={2}/>
      <circle cx={W*.50} cy={H*.29} r={H*.14}/>
      <circle cx={W*.50} cy={H*.29} r={H*.035} fill={color}/>
      <line x1={W*.50} y1={H*.29} x2={W*.50} y2={H*.16} strokeWidth={2}/>
      <rect x={W*.69} y={H*.12} width={W*.24} height={H*.30} rx="4"/>
      <text x={W*.81} y={H*.29} textAnchor="middle" fill={color} fontSize={H*.065} fontFamily="monospace" stroke="none">ODO</text>
      <rect x={W*.28} y={H*.68} width={W*.44} height={H*.18} rx="4"/>
      <text x={W*.50} y={H*.80} textAnchor="middle" fill={color} fontSize={H*.060} fontFamily="monospace" stroke="none">ODOMETER</text>
    </g>
  );

  if (shot === "undercarriage") return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <ellipse cx={W*.50} cy={H*.50} rx={W*.42} ry={H*.32}/>
      <ellipse cx={W*.50} cy={H*.50} rx={W*.42*.55} ry={H*.32*.55}/>
      {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => {
        const rad = deg * Math.PI / 180;
        return <line key={deg}
          x1={W*.50 + Math.cos(rad)*W*.42*.55} y1={H*.50 + Math.sin(rad)*H*.32*.55}
          x2={W*.50 + Math.cos(rad)*W*.42*.88} y2={H*.50 + Math.sin(rad)*H*.32*.88}
          strokeWidth={1.2}/>;
      })}
      <line x1={W*.08} y1={H*.50} x2={W*.92} y2={H*.50} strokeDasharray="5,4" strokeWidth={1}/>
      <line x1={W*.50} y1={H*.18} x2={W*.50} y2={H*.82} strokeDasharray="5,4" strokeWidth={1}/>
      <text x={W*.50} y={H*.88} textAnchor="middle" fill={color} fontSize={H*.050} fontFamily="Inter,sans-serif" stroke="none" opacity={.7}>CHECK FOR RUST</text>
    </g>
  );

  return null;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
// Props passed in from Lovable / platform parent:
//   vehicleType  — "sedan" | "compact_suv" | "midsize_suv" | "large_suv" | "truck" | "van"
//   enabledShots — string[] of shot IDs configured per dealer in admin panel
//   onComplete   — callback fired with captured photo map when all shots are done
export default function GhostCar({
  vehicleType  = "sedan",
  enabledShots = ALL_SHOTS.map(s => s.id),
  onComplete,
}) {
  const shots    = ALL_SHOTS.filter(s => enabledShots.includes(s.id));
  const [shotIndex,  setShotIndex]  = useState(0);
  const [colorIdx,   setColorIdx]   = useState(0);
  const [captured,   setCaptured]   = useState({});
  const [isPortrait, setIsPortrait] = useState(false);

  const archetype = ARCHETYPE_SHAPES[vehicleType] ? vehicleType : "sedan";
  const color     = OVERLAY_COLORS[colorIdx];
  const shot      = shots[shotIndex];
  const W = 480, H = 270;
  const done = Object.keys(captured).length;

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  const handleCapture = () => {
    setCaptured(c => ({ ...c, [shot.id]: true }));
    if (shotIndex < shots.length - 1) setTimeout(() => setShotIndex(i => i + 1), 400);
  };

  return (
    <div style={{
      fontFamily: "Inter, -apple-system, sans-serif",
      background: "#080c14",
      minHeight: "100vh",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      maxWidth: 540,
      margin: "0 auto",
    }}>

      {/* ── Header ── */}
      <div style={{ padding: "10px 16px", background: "#0d1320", borderBottom: "1px solid #1a2340", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: "#0099FF" }}>GHOSTCAR</div>
          <div style={{ fontSize: 9, color: "#2a4060", letterSpacing: 1 }}>PHOTO GUIDE</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 10, color: "#4a6080" }}>{done}/{shots.length}</div>
          <div style={{ width: 60, height: 4, background: "#1a2340", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${(done/shots.length)*100}%`, height: "100%", background: "#0099FF", transition: "width .3s" }}/>
          </div>
        </div>
      </div>

      {/* ── Vehicle type badge ── */}
      <div style={{ padding: "8px 16px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 600, letterSpacing: 1 }}>VEHICLE</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#0099FF", background: "#0099FF18", padding: "2px 8px", borderRadius: 10, border: "1px solid #0099FF44" }}>
          {ARCHETYPE_SHAPES[archetype]?.label}
        </div>
      </div>

      {/* ── Orientation nudge ── */}
      {isPortrait && shot?.orientation === "landscape" && (
        <div style={{ margin: "4px 16px", padding: "7px 12px", background: "#FF8C0015", border: "1px solid #FF8C0044", borderRadius: 6, fontSize: 10, color: "#FF8C00", textAlign: "center" }}>
          ↻ Rotate to landscape for best results on this shot
        </div>
      )}

      {/* ── Viewfinder ── */}
      <div style={{ padding: "8px 16px" }}>
        <div style={{ position: "relative", background: "#0a1020", borderRadius: 12, overflow: "hidden", border: "1px solid #1a2a40", aspectRatio: "16/9" }}>

          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, #0d1a2e 0%, #060a12 100%)" }}/>

          {/* Corner brackets */}
          {[[0,0],[1,0],[0,1],[1,1]].map(([r,b], i) => (
            <div key={i} style={{
              position: "absolute", zIndex: 3,
              [r?"right":"left"]: 10, [b?"bottom":"top"]: 10,
              width: 20, height: 20,
              borderTop:    !b ? `2px solid ${color}` : "none",
              borderBottom:  b ? `2px solid ${color}` : "none",
              borderLeft:   !r ? `2px solid ${color}` : "none",
              borderRight:   r ? `2px solid ${color}` : "none",
              opacity: .55,
            }}/>
          ))}

          {/* Rule-of-thirds grid */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {[W/3, W*2/3].map(x => <line key={x} x1={x} y1={0} x2={x} y2={H} stroke={color} strokeWidth={.4} opacity={.12}/>)}
            {[H/3, H*2/3].map(y => <line key={y} x1={0} y1={y} x2={W} y2={y} stroke={color} strokeWidth={.4} opacity={.12}/>)}
          </svg>

          {/* GhostCar silhouette overlay */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2 }} viewBox={`0 0 ${W} ${H}`}>
            <g opacity={.68}>
              <GhostCarSilhouette archetype={archetype} shot={shot?.id} color={color} W={W} H={H}/>
            </g>
          </svg>

          {/* Captured overlay */}
          {captured[shot?.id] && (
            <div style={{ position: "absolute", inset: 0, background: "#00FF8808", zIndex: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 40, opacity: .6 }}>✓</div>
            </div>
          )}

          {/* Instruction bar */}
          <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center", zIndex: 5 }}>
            <span style={{ background: "#00000090", backdropFilter: "blur(6px)", padding: "4px 14px", borderRadius: 20, fontSize: 10, color: "#ccc" }}>
              {shot?.desc}
            </span>
          </div>
        </div>
      </div>

      {/* ── Shot title + capture button ── */}
      <div style={{ textAlign: "center", padding: "6px 0 10px" }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{shot?.label}</div>
        <div style={{ fontSize: 10, color: "#3a5070", marginBottom: 12 }}>Photo {shotIndex + 1} of {shots.length}</div>
        <button onClick={handleCapture} style={{
          width: 68, height: 68, borderRadius: "50%",
          border: `3px solid ${captured[shot?.id] ? "#00FF88" : color}`,
          background: captured[shot?.id] ? "#00FF8818" : "#ffffff10",
          cursor: "pointer", fontSize: 24,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "all .2s",
        }}>
          {captured[shot?.id] ? "✓" : "📷"}
        </button>
      </div>

      {/* ── Shot pill nav ── */}
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
        {shots.map((s, i) => (
          <button key={s.id} onClick={() => setShotIndex(i)} style={{
            padding: "4px 9px", borderRadius: 20,
            border: `1px solid ${i === shotIndex ? color : captured[s.id] ? "#00FF8840" : "#1a2a40"}`,
            background: i === shotIndex ? `${color}18` : captured[s.id] ? "#00FF8810" : "transparent",
            color: i === shotIndex ? color : captured[s.id] ? "#00FF88" : "#2a4060",
            fontSize: 9.5, fontWeight: 600, cursor: "pointer",
          }}>
            {captured[s.id] ? "✓ " : ""}{s.label}
          </button>
        ))}
      </div>

      {/* ── Bottom controls ── */}
      <div style={{ padding: "8px 16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#2a4060", letterSpacing: 1 }}>OVERLAY</span>
          {OVERLAY_COLORS.map((c, i) => (
            <button key={c} onClick={() => setColorIdx(i)} style={{
              width: 18, height: 18, borderRadius: "50%", background: c,
              border: `2px solid ${colorIdx === i ? "#fff" : "#1a2a40"}`, cursor: "pointer",
            }}/>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShotIndex(i => Math.max(0, i-1))} disabled={shotIndex === 0}
            style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #1a2a40", background: "#0d1320", color: shotIndex === 0 ? "#2a4060" : "#8aaccc", fontSize: 11, cursor: shotIndex === 0 ? "default" : "pointer" }}>← Prev</button>
          <button onClick={() => setShotIndex(i => Math.min(shots.length-1, i+1))} disabled={shotIndex === shots.length-1}
            style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #1a2a40", background: "#0d1320", color: shotIndex === shots.length-1 ? "#2a4060" : "#8aaccc", fontSize: 11, cursor: shotIndex === shots.length-1 ? "default" : "pointer" }}>Next →</button>
        </div>
      </div>

      {/* ── Complete CTA ── */}
      {done === shots.length && (
        <div style={{ margin: "0 16px 20px", padding: 14, background: "#00FF8812", border: "1px solid #00FF8844", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#00FF88", marginBottom: 4 }}>All photos captured ✓</div>
          <button onClick={() => onComplete?.(captured)} style={{
            padding: "9px 24px", borderRadius: 6, background: "#00FF88", color: "#000",
            fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer",
          }}>Submit for Appraisal →</button>
        </div>
      )}

    </div>
  );
}
