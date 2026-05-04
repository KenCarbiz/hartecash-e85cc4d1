import PortalSkeleton from "@/components/PortalSkeleton";
import UploadSkeleton from "@/components/UploadSkeleton";
import { useState } from "react";

const LoaderPreview = () => {
  const [which, setWhich] = useState<"portal" | "upload">("portal");
  return (
    <div className="relative">
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-card/90 backdrop-blur border border-border rounded-full p-1 shadow-lg">
        <button
          onClick={() => setWhich("portal")}
          className={`px-3 py-1 text-xs rounded-full ${which === "portal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Portal
        </button>
        <button
          onClick={() => setWhich("upload")}
          className={`px-3 py-1 text-xs rounded-full ${which === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Upload
        </button>
      </div>
      {which === "portal" ? <PortalSkeleton /> : <UploadSkeleton />}
    </div>
  );
};

export default LoaderPreview;
