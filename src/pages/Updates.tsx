import { useState } from "react";
import { ArrowLeft, Sparkles, Shield, Bell, BarChart3, Wrench, Camera, FileText, Users, DollarSign, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Update {
  date: string;
  title: string;
  description: string;
  items: string[];
  icon: React.ReactNode;
  tag: "feature" | "improvement" | "fix" | "security";
}

const TAG_STYLES: Record<string, string> = {
  feature: "bg-accent/15 text-accent",
  improvement: "bg-primary/15 text-primary",
  fix: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  security: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const TAG_LABELS: Record<string, string> = {
  feature: "New Feature",
  improvement: "Improvement",
  fix: "Bug Fix",
  security: "Security",
};

const updates: Update[] = [
  {
    date: "2026-03-24",
    title: "Price Attribution & Audit Trail",
    description: "Full traceability for offered prices — know exactly who set it and how.",
    icon: <DollarSign className="w-5 h-5" />,
    tag: "feature",
    items: [
      "\"Auto · Customer Accepted\" badge when price is auto-set from estimate range",
      "\"Staff Set\" badge when price is manually entered by a manager",
      "Tooltips explaining each badge for staff clarity",
      "Activity log now records staff name + role (e.g. \"Jane D. — Admin\") instead of just role",
      "All price changes logged with old → new values and who made the change",
      "accept_offer RPC auto-populates offered_price from estimated_offer_high",
      "Bypass flag for role-check trigger during customer acceptance flow",
    ],
  },
  {
    date: "2026-03-23",
    title: "Role-Based Access Controls (RBAC)",
    description: "Server-side enforcement of who can edit prices, appraise vehicles, and advance deal stages.",
    icon: <Shield className="w-5 h-5" />,
    tag: "security",
    items: [
      "Only managers (Used Car Manager, GSM/GM, Admin) can set or update offered_price",
      "Only managers can enter ACV appraisal values",
      "Only GSM/GM or Admin can advance to manager_approval, price_agreed, or purchase_complete",
      "Appraised By field auto-populated with appraiser's name and title via database trigger",
      "Database trigger enforces all role restrictions server-side",
    ],
  },
  {
    date: "2026-03-22",
    title: "Notification System Overhaul",
    description: "Comprehensive multi-channel notifications with per-trigger recipient routing.",
    icon: <Bell className="w-5 h-5" />,
    tag: "feature",
    items: [
      "Per-trigger staff recipient routing — assign specific staff to specific notification types",
      "Customer notifications: offer ready, offer accepted, offer increased, appointment booked/reminder/rescheduled",
      "Staff notifications: new submission, hot lead, appointment booked, photos/docs uploaded, deal completed",
      "Quiet hours support with configurable start/end times",
      "Notification template editor with variable placeholders",
      "Full notification log with delivery status tracking",
    ],
  },
  {
    date: "2026-03-21",
    title: "Customer Portal & Deal Progress",
    description: "Self-service portal where customers track their deal from offer to purchase.",
    icon: <CheckCircle className="w-5 h-5" />,
    tag: "feature",
    items: [
      "Customer-facing progress tracker mirrored in admin dashboard",
      "Accepted offer card with price display",
      "What to bring checklist and what to expect guide",
      "Dealer contact card with phone/email",
      "Loan payoff information display",
      "Condition report summary",
      "Photo and document upload status",
    ],
  },
  {
    date: "2026-03-20",
    title: "Offer Engine & Simulator",
    description: "Configurable valuation engine with real-time what-if comparisons.",
    icon: <BarChart3 className="w-5 h-5" />,
    tag: "feature",
    items: [
      "Black Book API integration for wholesale and trade-in values",
      "Configurable condition multipliers, mileage tiers, and age tiers",
      "Flat-dollar deductions for damage, missing keys, accidents, etc.",
      "Global adjustment percentage and reconditioning cost",
      "Offer floor and ceiling guardrails",
      "What-If simulator showing dollar impact of unsaved config changes",
      "Custom offer rules with criteria matching and dashboard flags",
    ],
  },
  {
    date: "2026-03-19",
    title: "Photo & Document Upload System",
    description: "Mobile-optimized upload flows with QR code handoff and camera capture.",
    icon: <Camera className="w-5 h-5" />,
    tag: "feature",
    items: [
      "Guided photo capture with angle instructions",
      "QR code banner for desktop-to-mobile handoff",
      "Document camera capture for driver's license and title",
      "AI-powered driver's license OCR to auto-fill customer details",
      "AI-powered title/VIN parsing",
      "Admin-only delete permissions on uploaded assets",
    ],
  },
  {
    date: "2026-03-18",
    title: "Staff Management & Access Requests",
    description: "Invite-based staff onboarding with role assignment and profile management.",
    icon: <Users className="w-5 h-5" />,
    tag: "feature",
    items: [
      "Pending access request queue for new staff sign-ups",
      "Role assignment: Admin, Sales/BDC, Used Car Manager, GSM/GM",
      "Staff profile management with avatar upload and cropping",
      "Staff directory with role badges",
      "Bulk staff import from Excel",
    ],
  },
  {
    date: "2026-03-17",
    title: "Dashboard Analytics & Reporting",
    description: "At-a-glance metrics and exportable submission data.",
    icon: <BarChart3 className="w-5 h-5" />,
    tag: "feature",
    items: [
      "Submission volume charts and conversion funnel",
      "Lead source breakdown",
      "Hot lead identification and flagging",
      "Aging indicators on submission cards",
      "CSV/clipboard export of filtered submissions",
      "Print-ready check request and deal summary generation",
    ],
  },
  {
    date: "2026-03-16",
    title: "Multi-Location Support",
    description: "Manage multiple dealership locations with per-location scheduling and filtering.",
    icon: <Wrench className="w-5 h-5" />,
    tag: "feature",
    items: [
      "Dealership locations table with city/state/address",
      "Location selector in appointment scheduling",
      "Location filter in admin dashboard",
      "Footer location display with toggle control",
      "Location labels resolved from IDs throughout dashboard",
    ],
  },
  {
    date: "2026-03-15",
    title: "Site Configuration & Branding",
    description: "White-label customization from colors to content to comparison tables.",
    icon: <FileText className="w-5 h-5" />,
    tag: "improvement",
    items: [
      "Configurable dealership name, tagline, and hero text",
      "Primary, accent, and success color theming",
      "Logo and favicon upload",
      "Competitor comparison table with configurable columns and features",
      "Testimonial management with ratings and sort order",
      "Form field toggle configuration",
      "Stats customization (cars purchased, years in business, rating)",
    ],
  },
];

export default function Updates() {
  const navigate = useNavigate();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Platform Updates</h1>
            <p className="text-xs text-muted-foreground">Changelog & feature history</p>
          </div>
        </div>
      </header>

      {/* Timeline */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1">
            {updates.map((update, idx) => {
              const isExpanded = expandedIdx === idx;
              return (
                <div key={idx} className="relative pl-12">
                  {/* Dot */}
                  <div className={`absolute left-2.5 top-5 w-3 h-3 rounded-full border-2 transition-colors ${isExpanded ? "bg-primary border-primary" : "bg-background border-muted-foreground/30"}`} />

                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className="w-full text-left py-4 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 p-2 rounded-lg transition-colors ${isExpanded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {update.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">
                            {new Date(update.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TAG_STYLES[update.tag]}`}>
                            {TAG_LABELS[update.tag]}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mt-1 group-hover:text-primary transition-colors">
                          {update.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{update.description}</p>
                      </div>
                      <div className="shrink-0 mt-1 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="pb-4 -mt-1">
                      <ul className="space-y-1.5 ml-12">
                        {update.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-card-foreground">
                            <Sparkles className="w-3 h-3 text-accent shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-12 pb-8">
          — End of changelog —
        </p>
      </main>
    </div>
  );
}
