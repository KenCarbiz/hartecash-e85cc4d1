import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera, FileText, CalendarCheck, ArrowRight, Sparkles, Clock, CheckCircle2, PartyPopper, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface WhatsNextProps {
  mappedStatus: string;
  photosUploaded: boolean;
  docsUploaded: boolean;
  appointmentSet: boolean;
  token: string;
  vehicleStr: string;
  name: string;
  email: string;
  phone: string;
}

type BubbleVariant = "urgent" | "docs" | "photos" | "complete" | "default";

interface NextAction {
  emoji: string;
  title: string;
  description: string;
  actionLabel: string | null;
  actionIcon: typeof Camera | null;
  linkType: "upload" | "docs" | "schedule" | null;
  variant: BubbleVariant;
  badge?: string;
}

function getNextAction(status: string, photosUploaded: boolean, docsUploaded: boolean, appointmentSet: boolean): NextAction {
  const allDone = appointmentSet && docsUploaded && photosUploaded;

  // All three checklist items complete
  if (allDone) {
    return {
      emoji: "🎉",
      title: "You're All Set — See You Soon!",
      description: "Everything is uploaded and your visit is scheduled. We've got everything we need to make your appointment quick and easy. Just bring your vehicle and we'll handle the rest — you'll be out the door with a check in hand!",
      actionLabel: null,
      actionIcon: null,
      linkType: null,
      variant: "complete",
      badge: "Ready to Go",
    };
  }

  // Priority 1: Schedule inspection if not yet set
  if (!appointmentSet && ["offer_accepted", "new"].includes(status)) {
    return {
      emoji: "📅",
      title: "Schedule Your Inspection",
      description: "Book your dealership visit so we can complete a quick inspection and hand you a check. It only takes a minute!",
      actionLabel: "Schedule My Visit",
      actionIcon: CalendarCheck,
      linkType: "schedule",
      variant: "urgent",
      badge: "Action Required",
    };
  }

  // Priority 2: Upload documents (after appointment is set)
  if (!docsUploaded) {
    return {
      emoji: "📄",
      title: appointmentSet ? "Upload Documents Before Your Visit" : "Upload Your Documents",
      description: appointmentSet
        ? "Getting your registration, title, and driver's license uploaded now means less paperwork at the dealership — so you can get your check faster and spend less time waiting."
        : "We need your registration, title, and driver's license to finalize your offer.",
      actionLabel: "Upload Documents",
      actionIcon: FileText,
      linkType: "docs",
      variant: "docs",
      badge: appointmentSet ? "Save Time" : "Next Step",
    };
  }

  // Priority 3: Upload photos
  if (!photosUploaded) {
    return {
      emoji: "📸",
      title: appointmentSet ? "Snap a Few Photos to Speed Things Up" : "Upload Vehicle Photos",
      description: appointmentSet
        ? "Uploading photos of your vehicle ahead of time lets our team prepare in advance — meaning a faster inspection and less time at the dealership."
        : "Adding photos helps us verify your vehicle's condition and prepare a more accurate appraisal before you arrive.",
      actionLabel: "Upload Photos",
      actionIcon: Camera,
      linkType: "upload",
      variant: "photos",
      badge: appointmentSet ? "Almost There" : "Next Step",
    };
  }

  // Everything done but no appointment yet (edge case)
  if (!appointmentSet && ["offer_accepted"].includes(status)) {
    return {
      emoji: "📅",
      title: "You're All Set — Just Book Your Visit!",
      description: "Photos and documents are uploaded. Schedule your dealership visit so we can complete a quick inspection and hand you a check.",
      actionLabel: "Schedule My Visit",
      actionIcon: CalendarCheck,
      linkType: "schedule",
      variant: "urgent",
      badge: "Final Step",
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
      variant: "default",
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
      variant: "complete",
    };
  }

  return {
    emoji: "⏳",
    title: "We're On It",
    description: "Our team is working on your submission. We'll reach out as soon as there's an update!",
    actionLabel: null,
    actionIcon: null,
    linkType: null,
    variant: "default",
  };
}

const WhatsNextCard = ({ mappedStatus, photosUploaded, docsUploaded, appointmentSet, token, vehicleStr, name, email, phone }: WhatsNextProps) => {
  const action = getNextAction(mappedStatus, photosUploaded, docsUploaded, appointmentSet);
  const ActionIcon = action.actionIcon;

  const getLink = () => {
    if (action.linkType === "upload") return `/upload/${token}`;
    if (action.linkType === "docs") return `/docs/${token}`;
    if (action.linkType === "schedule")
      return `/schedule?token=${token}&vehicle=${encodeURIComponent(vehicleStr)}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`;
    return "";
  };

  // ─── VARIANT: Urgent (Schedule) — Red/accent bold CTA ───
  if (action.variant === "urgent" && action.actionLabel && ActionIcon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Link to={getLink()} className="block">
          <div className="relative overflow-hidden bg-gradient-to-br from-accent via-accent to-[hsl(210,100%,40%)] rounded-2xl p-6 shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all group">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            <div className="flex flex-wrap gap-3 mb-4">
              {photosUploaded && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-foreground" />
                  <span className="text-xs font-semibold text-accent-foreground/90">Photos Uploaded</span>
                </div>
              )}
              {docsUploaded && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-foreground" />
                  <span className="text-xs font-semibold text-accent-foreground/90">Documents Uploaded</span>
                </div>
              )}
            </div>

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
                    {action.badge || "Action Required"}
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
              <div className="flex items-center gap-1.5 text-accent-foreground font-bold text-sm animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] bg-white/20 rounded-full px-3 py-1 shadow-[0_0_12px_rgba(255,255,255,0.3)]">
                Book Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // ─── VARIANT: Docs — Warm amber/orange tones ───
  if (action.variant === "docs" && action.actionLabel && ActionIcon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Link to={getLink()} className="block">
          <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(35,90%,50%)] via-[hsl(25,85%,48%)] to-[hsl(15,80%,45%)] rounded-2xl p-6 shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all group">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="flex flex-wrap gap-3 mb-4">
              {appointmentSet && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span className="text-xs font-semibold text-white/90">Inspection Scheduled</span>
                </div>
              )}
              {photosUploaded && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span className="text-xs font-semibold text-white/90">Photos Uploaded</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white/30 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="bg-white/25 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                    {action.badge || "Next Step"}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white leading-tight">
                  {action.title}
                </h3>
              </div>
            </div>

            <p className="text-white/80 text-sm leading-relaxed mb-5">
              {action.description}
            </p>

            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between group-hover:bg-white/25 transition-colors">
              <div className="flex items-center gap-2 text-white">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-semibold">Skip paperwork at the dealership</span>
              </div>
              <div className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/20 rounded-full px-3 py-1">
                Upload Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // ─── VARIANT: Photos — Cool indigo/purple tones ───
  if (action.variant === "photos" && action.actionLabel && ActionIcon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Link to={getLink()} className="block">
          <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(245,70%,55%)] via-[hsl(255,65%,50%)] to-[hsl(270,60%,45%)] rounded-2xl p-6 shadow-xl cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all group">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {/* Decorative circles */}
            <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-white/5" />
            <div className="absolute bottom-6 right-12 w-10 h-10 rounded-full bg-white/5" />

            <div className="flex flex-wrap gap-3 mb-4">
              {appointmentSet && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span className="text-xs font-semibold text-white/90">Inspection Scheduled</span>
                </div>
              )}
              {docsUploaded && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span className="text-xs font-semibold text-white/90">Documents Uploaded</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white/30 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="bg-white/25 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                    {action.badge || "Next Step"}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white leading-tight">
                  {action.title}
                </h3>
              </div>
            </div>

            <p className="text-white/80 text-sm leading-relaxed mb-5">
              {action.description}
            </p>

            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between group-hover:bg-white/25 transition-colors">
              <div className="flex items-center gap-2 text-white">
                <Camera className="w-4 h-4" />
                <span className="text-sm font-semibold">Helps speed up your inspection</span>
              </div>
              <div className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/20 rounded-full px-3 py-1">
                Add Photos
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // ─── VARIANT: Complete — Green celebration ───
  if (action.variant === "complete") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(142,71%,40%)] via-[hsl(152,65%,38%)] to-[hsl(162,60%,35%)] rounded-2xl p-6 shadow-xl">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          {/* Decorative */}
          <div className="absolute top-3 right-6 w-16 h-16 rounded-full bg-white/5" />
          <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/5" />
          <div className="absolute top-10 right-16 w-6 h-6 rounded-full bg-white/5" />

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-semibold text-white/90">Inspection Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-semibold text-white/90">Documents Uploaded</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-semibold text-white/90">Photos Uploaded</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <PartyPopper className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="bg-white/25 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                  {action.badge || "Ready to Go"}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white leading-tight">
                {action.title}
              </h3>
            </div>
          </div>

          <p className="text-white/80 text-sm leading-relaxed">
            {action.description}
          </p>
        </div>
      </motion.div>
    );
  }

  // ─── VARIANT: Default — subtle card ───
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