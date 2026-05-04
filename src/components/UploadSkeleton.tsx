import drivingCar from "@/assets/driving-car.svg";

const UploadSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <img
        src={drivingCar}
        alt=""
        className="mx-auto mb-4 w-[320px] h-[200px]"
      />
      <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading photos...</p>
    </div>
  </div>
);

export default UploadSkeleton;
