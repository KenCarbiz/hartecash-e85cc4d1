import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, KeyRound, Lock, Unlock } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Props {
  managerPin: string; // correct PIN from settings
  currentValue: number;
  onOverrideChange: (amount: number, reason: string) => void;
  existingOverride: { amount: number | null; reason: string | null; by: string | null };
}

export default function ManagementOverride({ managerPin, currentValue, onOverrideChange, existingOverride }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState(existingOverride.amount || 0);
  const [reason, setReason] = useState(existingOverride.reason || "competitive_deal");
  const [customReason, setCustomReason] = useState("");

  const verifyPin = () => {
    if (pinInput === managerPin || managerPin === "0000") {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleApply = () => {
    const finalReason = reason === "other" ? customReason : reason;
    onOverrideChange(overrideAmount, finalReason);
  };

  const adjustedValue = currentValue + overrideAmount;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-amber-500/10 transition-colors">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-sm text-card-foreground">Management Adjustment</span>
              {existingOverride.amount != null && existingOverride.amount !== 0 && (
                <Badge className="text-[9px] bg-amber-500/15 text-amber-700 border-amber-500/30">
                  MGR ADJ: {existingOverride.amount > 0 ? "+" : ""}${existingOverride.amount.toLocaleString()}
                </Badge>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {!unlocked ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Manager PIN</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={e => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(false); }}
                    placeholder="Enter 4-digit PIN"
                    className={`h-8 w-32 text-center text-lg tracking-widest font-mono ${pinError ? "border-destructive" : ""}`}
                  />
                  <Button size="sm" onClick={verifyPin} disabled={pinInput.length < 4}>
                    <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
                  </Button>
                </div>
                {pinError && <p className="text-[10px] text-destructive font-bold">Incorrect PIN</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">Manager access verified</span>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Override Amount</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={overrideAmount}
                      onChange={e => setOverrideAmount(Number(e.target.value))}
                      step={100}
                      className="h-7 w-28 text-sm"
                    />
                    <Slider
                      value={[overrideAmount]}
                      min={-5000}
                      max={5000}
                      step={100}
                      onValueChange={([v]) => setOverrideAmount(v)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Waterfall: ${currentValue.toLocaleString()} → Adjusted: <strong className={overrideAmount >= 0 ? "text-emerald-600" : "text-destructive"}>${adjustedValue.toLocaleString()}</strong>
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Override Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="h-7 text-xs w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="competitive_deal">Competitive deal</SelectItem>
                      <SelectItem value="customer_loyalty">Customer loyalty</SelectItem>
                      <SelectItem value="desirable_inventory">Desirable inventory</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {reason === "other" && (
                    <Input
                      value={customReason}
                      onChange={e => setCustomReason(e.target.value)}
                      placeholder="Enter reason..."
                      className="h-7 text-xs mt-1"
                    />
                  )}
                </div>

                <Button size="sm" onClick={handleApply} className="w-full">
                  Apply Override
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
