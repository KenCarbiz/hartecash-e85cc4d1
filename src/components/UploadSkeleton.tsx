import ghostCar from "@/assets/ghost-loader.png";

const UploadSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="relative mx-auto mb-4 w-[280px] h-[160px]">
        <img
          src={ghostCar}
          alt=""
          className="w-full h-full object-contain opacity-50"
          style={{
            filter: "grayscale(0.3) brightness(1.1)",
            animation: "car-bounce 1.2s ease-in-out infinite",
          }}
        />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 280 160">
          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes car-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
            @keyframes road-scroll { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -40; } }
          `}</style>
          <g style={{ transformOrigin: "82px 130px", animation: "spin 0.8s linear infinite" }}>
            <line x1="82" y1="120" x2="82" y2="140" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
            <line x1="72" y1="130" x2="92" y2="130" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
            <line x1="75" y1="123" x2="89" y2="137" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
            <line x1="75" y1="137" x2="89" y2="123" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
          </g>
          <g style={{ transformOrigin: "198px 130px", animation: "spin 0.8s linear infinite" }}>
            <line x1="198" y1="120" x2="198" y2="140" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
            <line x1="188" y1="130" x2="208" y2="130" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
            <line x1="191" y1="123" x2="205" y2="137" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
            <line x1="191" y1="137" x2="205" y2="123" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
          </g>
          <line
            x1="0" y1="148" x2="280" y2="148"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2.5"
            strokeDasharray="14 10"
            opacity="0.3"
            style={{ animation: "road-scroll 0.6s linear infinite" }}
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading photos...</p>
    </div>
  </div>
);

export default UploadSkeleton;
