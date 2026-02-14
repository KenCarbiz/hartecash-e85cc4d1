const PortalSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="64" viewBox="0 0 120 64" className="mx-auto mb-4">
        <style>{`
          @keyframes hc-spin { to { transform: rotate(360deg); } }
          @keyframes hc-dash { to { stroke-dashoffset: -40; } }
          @keyframes hc-fade {
            0%,100% { opacity:.25; transform: translateX(0); }
            50%     { opacity:.6;  transform: translateX(8px); }
          }
        `}</style>
        <g fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20,40 L20,36 Q20,28 28,28 L40,28 L50,20 L80,20 Q88,20 90,28 L100,28 Q104,28 104,32 L104,40" opacity=".18" />
          <path d="M20,40 L20,36 Q20,28 28,28 L40,28 L50,20 L80,20 Q88,20 90,28 L100,28 Q104,28 104,32 L104,40" strokeDasharray="20 20" style={{ animation: "hc-dash 1.2s linear infinite" }} />
          <line x1="50" y1="28" x2="50" y2="20" opacity=".25" />
          <line x1="52" y1="28" x2="68" y2="28" opacity=".15" />
          <circle cx="36" cy="44" r="7" opacity=".18" />
          <circle cx="36" cy="44" r="7" strokeDasharray="12 32" style={{ animation: "hc-spin .8s linear infinite", transformOrigin: "36px 44px" }} />
          <circle cx="88" cy="44" r="7" opacity=".18" />
          <circle cx="88" cy="44" r="7" strokeDasharray="12 32" style={{ animation: "hc-spin .8s linear infinite", transformOrigin: "88px 44px" }} />
          <line x1="2" y1="34" x2="14" y2="34" style={{ animation: "hc-fade 1.4s ease-in-out infinite" }} />
          <line x1="4" y1="40" x2="16" y2="40" style={{ animation: "hc-fade 1.4s ease-in-out infinite .2s" }} />
          <line x1="6" y1="46" x2="16" y2="46" style={{ animation: "hc-fade 1.4s ease-in-out infinite .4s" }} />
        </g>
      </svg>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading your submission...</p>
    </div>
  </div>
);

export default PortalSkeleton;
