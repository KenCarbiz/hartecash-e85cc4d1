import car from "@/assets/loader-car.png";

const Wheel = ({ left }: { left: string }) => (
  <svg
    viewBox="0 0 40 40"
    className="absolute h-[5%] w-auto aspect-square animate-spin"
    style={{ left, top: "49.5%", transform: "translate(-50%, -50%)", animationDuration: "0.6s" }}
    aria-hidden
  >
    <circle cx="20" cy="20" r="18" fill="none" stroke="hsl(217 40% 35%)" strokeWidth="2.5" />
    <circle cx="20" cy="20" r="11" fill="none" stroke="hsl(217 40% 35%)" strokeWidth="1.5" />
    <circle cx="20" cy="20" r="2.5" fill="hsl(217 40% 35%)" />
    {[0, 60, 120].map((deg) => (
      <line
        key={deg}
        x1="20"
        y1="3"
        x2="20"
        y2="37"
        stroke="hsl(217 40% 35%)"
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${deg} 20 20)`}
      />
    ))}
  </svg>
);

const LoaderPreview = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-8">
    <div className="relative w-full max-w-3xl">
      <img src={car} alt="Car" className="w-full h-auto" />
      <Wheel left="37.8%" />
      <Wheel left="63.8%" />
    </div>
  </div>
);

export default LoaderPreview;
