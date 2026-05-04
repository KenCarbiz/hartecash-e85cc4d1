import car from "@/assets/loader-car-body.png";

const LoaderPreview = () => (
  <div className="min-h-screen flex items-center justify-center bg-black p-8">
    <img src={car} alt="Loading" className="max-w-full h-auto" />
  </div>
);

export default LoaderPreview;
