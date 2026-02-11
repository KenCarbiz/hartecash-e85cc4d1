import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, Smartphone } from "lucide-react";
import type { VehicleInfo } from "./types";

interface Props {
  uploadUrl: string;
  vehicleInfo: VehicleInfo | null;
  nextStep: string;
}

const SubmissionSuccess = ({ uploadUrl, vehicleInfo, nextStep }: Props) => {
  if (nextStep === "visit") {
    return (
      <div className="text-center py-6">
        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-card-foreground mb-2">You're All Set!</h3>
        {vehicleInfo && (
          <p className="text-base font-semibold text-card-foreground mb-2">
            {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
          </p>
        )}
        <p className="text-muted-foreground">
          We'll contact you shortly to schedule your in-person visit.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <div className="text-5xl mb-3">📸</div>
      <h3 className="text-xl font-bold text-card-foreground mb-1">
        Scan to Upload Photos
      </h3>
      {vehicleInfo && (
        <p className="text-sm font-semibold text-card-foreground mb-1">
          {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
        </p>
      )}
      <p className="text-muted-foreground text-sm mb-5">
        Scan this QR code with your phone to take and upload vehicle photos.
      </p>

      <div className="bg-white p-4 rounded-xl inline-block shadow-lg mb-5">
        <QRCodeSVG value={uploadUrl} size={200} level="H" />
      </div>

      <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4 text-left">
        <Smartphone className="w-8 h-8 text-accent shrink-0" />
        <div>
          <p className="text-sm font-semibold text-card-foreground">Using your phone?</p>
          <a
            href={uploadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent underline font-medium"
          >
            Tap here to upload photos directly →
          </a>
        </div>
      </div>
    </div>
  );
};

export default SubmissionSuccess;
