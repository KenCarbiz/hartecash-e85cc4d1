const UploadSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="80" viewBox="0 0 160 80" className="mx-auto mb-4">
        <style>{`
          @keyframes hc-spin { to { transform: rotate(360deg); } }
          @keyframes hc-dash { to { stroke-dashoffset: -40; } }
          @keyframes hc-fade {
            0%,100% { opacity:.14; transform: translateX(0); }
            50%     { opacity:.30; transform: translateX(-10px); }
          }
        `}</style>
        <g fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M25,52 L25,46 Q25,38 33,38 L48,38 L58,28 L100,28 Q110,28 112,38 L128,38 Q134,38 134,44 L134,52" opacity=".18" />
          <path d="M25,52 L25,46 Q25,38 33,38 L48,38 L58,28 L100,28 Q110,28 112,38 L128,38 Q134,38 134,44 L134,52" strokeDasharray="20 20" style={{ animation: "hc-dash 1.2s linear infinite" }} />
          <line x1="58" y1="38" x2="58" y2="28" opacity=".25" />
          <line x1="60" y1="38" x2="85" y2="38" opacity=".15" />
          <circle cx="44" cy="56" r="8" opacity=".18" />
          <circle cx="44" cy="56" r="8" strokeDasharray="14 36" style={{ animation: "hc-spin .8s linear infinite", transformOrigin: "44px 56px" }} />
          <circle cx="116" cy="56" r="8" opacity=".18" />
          <circle cx="116" cy="56" r="8" strokeDasharray="14 36" style={{ animation: "hc-spin .8s linear infinite", transformOrigin: "116px 56px" }} />
          <line x1="2" y1="42" x2="16" y2="42" style={{ animation: "hc-fade 1.4s ease-in-out infinite" }} />
          <line x1="4" y1="50" x2="18" y2="50" style={{ animation: "hc-fade 1.4s ease-in-out infinite .2s" }} />
          <line x1="6" y1="58" x2="18" y2="58" style={{ animation: "hc-fade 1.4s ease-in-out infinite .4s" }} />
          <circle cx="130" cy="42" r="2" fill="hsl(var(--accent))" opacity=".5" style={{ animation: "hc-fade 1.4s ease-in-out infinite .1s" }} />
        </g>
      </svg>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading photos...</p>
    </div>
  </div>
);

export default UploadSkeleton;
