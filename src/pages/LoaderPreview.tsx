import car from "@/assets/loader-car.png";

const LoaderPreview = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-8">
    <img src={car} alt="Car" className="max-w-full h-auto" />
  </div>
);

export default LoaderPreview;
