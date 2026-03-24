import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import frontImg from "@/assets/photo-guide/front.jpg";
import rearImg from "@/assets/photo-guide/rear.jpg";
import driverSideImg from "@/assets/photo-guide/driver-side.jpg";
import passengerSideImg from "@/assets/photo-guide/passenger-side.jpg";
import dashboardImg from "@/assets/photo-guide/dashboard.jpg";
import interiorImg from "@/assets/photo-guide/interior.jpg";

const GUIDE_ITEMS = [
  { label: "Front", img: frontImg, tip: "Centered, full vehicle visible" },
  { label: "Rear", img: rearImg, tip: "Centered, license plate visible" },
  { label: "Driver Side", img: driverSideImg, tip: "Full side view, a few feet away" },
  { label: "Passenger Side", img: passengerSideImg, tip: "Full side view, a few feet away" },
  { label: "Dashboard", img: dashboardImg, tip: "Odometer reading clearly visible" },
  { label: "Interior", img: interiorImg, tip: "Front seats, console & steering wheel" },
];

const PhotoGuide = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-3"
      >
        <HelpCircle className="w-4 h-4" />
        Photo Guide — What angles do I need?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card z-10 flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-card-foreground text-base">📸 Required Photo Guide</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Take these 6 photos for an accurate appraisal. Match the angles shown below.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {GUIDE_ITEMS.map((item) => (
                  <div key={item.label} className="bg-muted/50 rounded-xl overflow-hidden border border-border">
                    <img
                      src={item.img}
                      alt={`${item.label} angle reference`}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                      width={256}
                      height={256}
                    />
                    <div className="p-2">
                      <span className="text-xs font-bold text-card-foreground block">{item.label}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight block">{item.tip}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhotoGuide;
