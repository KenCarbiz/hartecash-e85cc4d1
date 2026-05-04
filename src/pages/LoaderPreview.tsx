import car from "@/assets/loader-car.png";
import wheel from "@/assets/loader-wheel.png";

// Car PNG is 1536x1024. Visible body bbox ≈ x:348-1189, y:356-569.
// Place wheels at fender positions (percentages of full image).
const wheels = [
  { left: "30.5%", top: "49%" }, // front
  { left: "67%", top: "49%" },   // rear
];

const LoaderPreview = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-8">
    <style>{`
      @keyframes loader-spin { to { transform: rotate(360deg); } }
      .loader-wheel { animation: loader-spin 0.9s linear infinite; transform-origin: 50% 50%; }
    `}</style>
    <div className="relative w-full max-w-[640px]">
      <img src={car} alt="" className="w-full h-auto block" />
      {wheels.map((w, i) => (
        <img
          key={i}
          src={wheel}
          alt=""
          className="loader-wheel absolute"
          style={{
            left: w.left,
            top: w.top,
            width: "10.4%",
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  </div>
);

export default LoaderPreview;
