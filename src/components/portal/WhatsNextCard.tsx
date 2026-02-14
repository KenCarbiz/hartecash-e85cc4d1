import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, FileText, CalendarCheck, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface WhatsNextProps {
  mappedStatus: string;
  photosUploaded: boolean;
  docsUploaded: boolean;
  token: string;
  vehicleStr: string;
  name: string;
  email: string;
  phone: string;
}

function getNextAction(status: string, photosUploaded: boolean, docsUploaded: boolean) {
  // Priority: photos → docs → schedule → waiting
  if (!photosUploaded) {
    return {
      emoji: "📸",
      title: "Upload Your Photos",
      description: "Help us give you the best offer by uploading clear photos of your vehicle.",
      actionLabel: "Upload Photos",
      actionIcon: Camera,
      linkType: "upload" as const,
    };
  }
  if (!docsUploaded) {
    return {
      emoji: "📄",
      title: "Upload Your Documents",
      description: "We need your registration, title, and driver's license to move forward.",
      actionLabel: "Upload Documents",
      actionIcon: FileText,
      linkType: "docs" as const,
    };
  }
  if (["offer_made", "contacted"].includes(status)) {
    return {
      emoji: "📅",
      title: "Schedule Your Visit",
      description: "Everything looks great! Book a time to bring your vehicle in and finalize the deal.",
      actionLabel: "Schedule Now",
      actionIcon: CalendarCheck,
      linkType: "schedule" as const,
    };
  }
  if (status === "inspection_scheduled") {
    return {
      emoji: "🚗",
      title: "You're All Set!",
      description: "Your inspection is scheduled. Just bring your vehicle and we'll handle the rest.",
      actionLabel: null,
      actionIcon: null,
      linkType: null,
    };
  }
  if (status === "purchase_complete") {
    return {
      emoji: "🎉",
      title: "Congratulations!",
      description: "Your vehicle purchase is complete. Thank you for choosing Harte Auto Group!",
      actionLabel: null,
      actionIcon: null,
      linkType: null,
    };
  }
  return {
    emoji: "⏳",
    title: "We're On It",
    description: "Our team is working on your submission. We'll reach out as soon as there's an update!",
    actionLabel: null,
    actionIcon: null,
    linkType: null,
  };
}

const WhatsNextCard = ({ mappedStatus, photosUploaded, docsUploaded, token, vehicleStr, name, email, phone }: WhatsNextProps) => {
  const action = getNextAction(mappedStatus, photosUploaded, docsUploaded);
  const ActionIcon = action.actionIcon;

  const getLink = () => {
    if (action.linkType === "upload") return `/upload/${token}`;
    if (action.linkType === "docs") return `/docs/${token}`;
    if (action.linkType === "schedule")
      return `/schedule?token=${token}&vehicle=${encodeURIComponent(vehicleStr)}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`;
    return "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl p-5 shadow-lg border border-primary/10"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-accent" />
        <h3 className="font-bold text-sm text-card-foreground uppercase tracking-wide">What's Next</h3>
      </div>
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{action.emoji}</span>
        <div className="flex-1">
          <p className="font-bold text-card-foreground">{action.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
          {action.actionLabel && ActionIcon && (
            <Link to={getLink()}>
              <Button size="sm" className="mt-3 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                <ActionIcon className="w-4 h-4" />
                {action.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default WhatsNextCard;
