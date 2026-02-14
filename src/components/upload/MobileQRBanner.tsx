import { QRCodeSVG } from "qrcode.react";
import { Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileQRBannerProps {
  url: string;
}

const MobileQRBanner = ({ url }: MobileQRBannerProps) => {
  const isMobile = useIsMobile();

  // Don't show on mobile — user is already on their phone
  if (isMobile) return null;

  return (
    <div className="bg-card rounded-xl p-5 shadow-lg mb-6 text-center">
      <p className="text-sm font-semibold text-card-foreground mb-3">
        📱 Easier on your phone? Scan to continue there:
      </p>
      <div className="bg-white p-3 rounded-xl inline-block shadow mb-3">
        <QRCodeSVG value={url} size={140} level="H" />
      </div>
      <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4 text-left">
        <Smartphone className="w-10 h-10 text-accent shrink-0" />
        <div>
          <p className="text-sm font-semibold text-card-foreground">Using your phone?</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent underline font-medium"
          >
            Tap here to open on mobile →
          </a>
        </div>
      </div>
    </div>
  );
};

export default MobileQRBanner;
