import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, FileText, CalendarCheck, ArrowRight, Sparkles, Clock } from "lucide-react";
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

interface NextAction {
  emoji: string;
  title: string;
  description: string;
  actionLabel: string | null;
  actionIcon: typeof Camera | null;
  linkType: "upload" | "docs" | "schedule" | null;
  urgent?: boolean;
}

function getNextAction(status: string, photosUploaded: boolean, docsUploaded: boolean): NextAction {
  if (!photosUploaded) {
    return {
      emoji: "📸",
      title: "Upload Photos & Documents",
      description: "Uploading photos and documents will speed up the process and get you a check faster.",
      actionLabel: "Upload Photos",
      actionIcon: Camera,
      linkType: "upload",
    };
  }
  if (!docsUploaded) {
    return {
      emoji: "📄",
      title: "Upload Your Documents",
      description: "We need your registration, title, and driver's license to move forward.",
      actionLabel: "Upload Documents",
      actionIcon: FileText,
      linkType: "docs",
    };
  }
  if (["offer_made", "contacted"].includes(status)) {
    return {
      emoji: "📅",
      title: "Schedule Your In-Person Inspection",
      description: "You're almost there! The last step is to book your visit so we can finalize your offer and hand you a check.",
      actionLabel: "Schedule My Inspection",
      actionIcon: CalendarCheck,
      linkType: "schedule",
      urgent: true,
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
      description: "Your vehicle purchase is complete. Thank you for choosing us!",
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

  // Urgent scheduling CTA — big, bold, impossible to miss
  if (action.urgent && action.actionLabel && ActionIcon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Link to={getLink()} className="block">
          <div className="relative overflow-hidden bg-gradient-to-br from-accent via-accent to-[hsl(210,100%,40%)] rounded-2xl p-6 shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all group">
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            
            {/* Pulsing ring behind icon */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <CalendarCheck className="w-7 h-7 text-accent-foreground" />
                </div>
                <span className="absolute inset-0 rounded-full animate-ping bg-white/20" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="bg-white/25 text-accent-foreground text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                    Final Step
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-accent-foreground leading-tight">
                  {action.title}
                </h3>
              </div>
            </div>

            <p className="text-accent-foreground/80 text-sm leading-relaxed mb-5">
              {action.description}
            </p>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between group-hover:bg-white/30 transition-colors">
              <div className="flex items-center gap-2 text-accent-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-semibold">Takes less than 1 minute</span>
              </div>
              <div className="flex items-center gap-1.5 text-accent-foreground font-bold text-sm">
                Book Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // Standard card for other steps
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
