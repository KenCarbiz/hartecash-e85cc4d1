import car from "@/assets/loader-car-body.png";

const LoaderPreview = () => (
  <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#e5e7eb" }}>
    <img
      src={car}
      alt="Loading"
      className="h-auto loader-car"
      style={{ width: "25%" }}
    />
    <style>{`
      @keyframes loaderCarPulse {
        0%, 100% { transform: scaleX(-1) scale(1); opacity: 0.85; }
        50%      { transform: scaleX(-1) scale(1.04); opacity: 1; }
      }
      .loader-car {
        transform: scaleX(-1);
        transform-origin: center;
        animation: loaderCarPulse 1.8s ease-in-out infinite;
        will-change: transform, opacity;
      }
    `}</style>
  </div>
);

export default LoaderPreview;
