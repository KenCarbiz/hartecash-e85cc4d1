import { Link } from "react-router-dom";
import { CheckCircle, Circle, Camera, FileText, CalendarCheck, ArrowRight, PartyPopper, ClipboardCheck } from "lucide-react";
import { motion } from "framer-motion";

interface CompletionChecklistProps {
  photosUploaded: boolean;
  docsUploaded: boolean;
  appointmentSet: boolean;
  token: string;
  scheduleLink: string;
}

const CompletionChecklist = ({ photosUploaded, docsUploaded, appointmentSet, token, scheduleLink }: CompletionChecklistProps) => {
  const items = [
    {
      label: "Schedule Inspection",
      done: appointmentSet,
      icon: CalendarCheck,
      link: scheduleLink,
      actionLabel: "Schedule Now",
    },
    {
      label: "Documents",
      done: docsUploaded,
      icon: FileText,
      link: `/docs/${token}`,
      actionLabel: "Upload Documents",
    },
    {
      label: "Vehicle Photos",
      done: photosUploaded,
      icon: Camera,
      link: `/upload/${token}`,
      actionLabel: "Upload Photos",
      hint: "Photos help increase your offer",
    },
  ];

  const doneCount = items.filter(i => i.done).length;
  const allDone = doneCount === items.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={`rounded-2xl shadow-xl overflow-hidden border transition-colors ${allDone ? "bg-success/5 border-success/30" : "bg-card border-border/50"}`}
    >
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-card-foreground">Your Checklist</h3>
          </div>
          <span className="text-xs text-muted-foreground">{doneCount}/{items.length}</span>
        </div>
      </div>

      <div className="p-5">
        {allDone && (
          <div className="flex items-start gap-3 mb-4">
            <PartyPopper className="w-6 h-6 text-success flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-success text-base">You're All Set!</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Everything looks great — we'll see you at your inspection to complete the sale. Just bring your vehicle and ID!
              </p>
            </div>
          </div>
        )}

        {/* Mini progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
          <motion.div
            className="h-full bg-success rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(doneCount / items.length) * 100}%` }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.link}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  item.done
                    ? "bg-success/5 hover:bg-success/10"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                {item.done ? (
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                )}
                <Icon className={`w-4 h-4 flex-shrink-0 ${item.done ? "text-success" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <span className={`text-sm ${item.done ? "text-success font-medium" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                  {!item.done && item.hint && (
                    <p className="text-[10px] text-primary/70 font-medium mt-0.5">{item.hint}</p>
                  )}
                </div>
                {!item.done && (
                  <span className="text-xs text-accent font-medium flex items-center gap-1">
                    {item.actionLabel} <ArrowRight className="w-3 h-3" />
                  </span>
                )}
                {item.done && item.label !== "Schedule Inspection" && (
                  <span className="text-xs text-success font-medium flex items-center gap-1">
                    Upload More <ArrowRight className="w-3 h-3" />
                  </span>
                )}
                {item.done && item.label === "Schedule Inspection" && (
                  <span className="text-xs text-success font-medium">Booked ✓</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default CompletionChecklist;
