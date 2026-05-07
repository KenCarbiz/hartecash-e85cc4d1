import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, MessageSquare, Sparkles } from "lucide-react";
import { useObjectionPlaybook } from "@/hooks/useObjectionPlaybook";

interface ObjectionCardInlineProps {
  declinedReason: string | null;
  competitor: string | null;
  dealershipId?: string | null;
}

/**
 * Inline objection coaching card on the customer file. When the lead
 * has a declined_reason or competitor_mentioned that matches an
 * objection playbook entry, surfaces the BDC reframe + proof points
 * + escalation path right above the comms composer so the rep can
 * read it while they're calling or typing.
 *
 * Renders nothing when no card matches — silent fallback so leads
 * without a known objection don't get a noisy empty state.
 */
const ObjectionCardInline = ({ declinedReason, competitor, dealershipId }: ObjectionCardInlineProps) => {
  const { findCardForLead, missing } = useObjectionPlaybook(dealershipId || "default");
  const [open, setOpen] = useState(false);
  if (missing) return null;

  const card = findCardForLead({
    declined_reason: declinedReason,
    competitor,
  });
  if (!card) return null;

  return (
    <Card className="border-info/30 bg-info/[0.03]">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-info/5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-info/10 text-info flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-micro font-bold uppercase tracking-wider text-info">
              Coaching · objection match
            </div>
            <div className="text-sm font-bold text-foreground truncate">{card.label}</div>
          </div>
          <Badge variant="outline" className="text-micro">{card.category}</Badge>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="border-t border-info/20 p-4 space-y-3 text-sm">
            <div>
              <div className="text-micro font-bold uppercase tracking-wider text-muted-foreground mb-1">
                What they really mean
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{card.customer_concern}</p>
            </div>

            <div>
              <div className="text-micro font-bold uppercase tracking-wider text-muted-foreground mb-1 inline-flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                What to say back
              </div>
              <p className="text-xs text-foreground leading-relaxed bg-card border border-border rounded-md p-3">
                {card.dealer_reframe}
              </p>
            </div>

            {card.proof_points && card.proof_points.length > 0 && (
              <div>
                <div className="text-micro font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Proof you can show
                </div>
                <ul className="space-y-1.5">
                  {card.proof_points.map((p, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-bold text-foreground">{p.label}:</span>{" "}
                      <span className="text-muted-foreground">{p.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {card.escalation_path && (
              <div className="pt-2 border-t border-info/20">
                <div className="text-micro font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  If reframe doesn't close
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{card.escalation_path}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ObjectionCardInline;
