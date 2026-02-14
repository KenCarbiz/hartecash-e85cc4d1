import ghostCar from "@/assets/ghost-loader.png";

const PortalSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="relative mx-auto mb-4 w-[320px] h-[200px]">
        <img
          src={ghostCar}
          alt=""
          className="w-full h-full object-contain"
          style={{
            animation: "car-bounce 1.2s ease-in-out infinite",
          }}
        />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 320 200">
          <style>{`
            @keyframes car-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
            @keyframes road-scroll { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -40; } }
          `}</style>
          {/* Scrolling ground line */}
          <line
            x1="0" y1="170" x2="320" y2="170"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
            strokeDasharray="12 8"
            opacity="0.4"
            style={{ animation: "road-scroll 0.6s linear infinite" }}
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading your submission...</p>
    </div>
  </div>
);

export default PortalSkeleton;
