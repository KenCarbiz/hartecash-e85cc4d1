import RunningCarLoader from "@/components/landing/RunningCarLoader";

const LoaderPreview = () => (
  <div
    className="min-h-screen flex items-center justify-center p-8"
    style={{ backgroundColor: "#e5e7eb" }}
  >
    <div style={{ transform: "scaleX(-1)" }}>
      <RunningCarLoader size="lg" color="#5B6B8A" />
    </div>
  </div>
);

export default LoaderPreview;
