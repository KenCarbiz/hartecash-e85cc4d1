import car from "@/assets/loader-car-body.png";

const LoaderPreview = () => (
  <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#e5e7eb" }}>
    <img src={car} alt="Loading" className="h-auto" style={{ width: "25%", transform: "scaleX(-1)" }} />
  </div>
);

export default LoaderPreview;
