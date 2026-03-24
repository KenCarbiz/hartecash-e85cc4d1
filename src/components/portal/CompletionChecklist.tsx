import { Link } from "react-router-dom";
import { CheckCircle, Circle, Camera, FileText, CalendarCheck, ArrowRight } from "lucide-react";
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
      label: "Vehicle Photos",
      done: photosUploaded,
      icon: Camera,
      link: `/upload/${token}`,
      actionLabel: "Upload Photos",
    },
    {
      label: "Documents",
      done: docsUploaded,
      icon: FileText,
      link: `/docs/${token}`,
      actionLabel: "Upload Documents",
    },
    {
      label: "Schedule Inspection",
      done: appointmentSet,
      icon: CalendarCheck,
      link: scheduleLink,
      actionLabel: "Schedule Now",
    },
  ];

  const doneCount = items.filter(i => i.done).length;
  const allDone = doneCount === items.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="bg-card rounded-xl p-5 shadow-lg"
    >
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-bold text-card-foreground">Your Checklist</h3>
        <span className="text-xs text-muted-foreground ml-auto">{doneCount}/{items.length}</span>
        {allDone && <span className="text-xs bg-success/10 text-success font-semibold px-2 py-0.5 rounded-full">All done!</span>}
      </div>

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
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className={`text-sm flex-1 ${item.done ? "text-card-foreground" : "text-muted-foreground"}`}>
                {item.label}
              </span>
              {!item.done && (
                <span className="text-xs text-accent font-medium flex items-center gap-1">
                  {item.actionLabel} <ArrowRight className="w-3 h-3" />
                </span>
              )}
              {item.done && item.label !== "Schedule Inspection" && (
                <span className="text-xs text-muted-foreground">Upload more</span>
              )}
              {item.done && item.label === "Schedule Inspection" && (
                <span className="text-xs text-success font-medium">Booked ✓</span>
              )}
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default CompletionChecklist;
