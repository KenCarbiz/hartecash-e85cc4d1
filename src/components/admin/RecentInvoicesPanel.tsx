import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, Loader2 } from "lucide-react";

type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: string;
  period_start: string | null;
  period_end: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

/**
 * Inline list of the dealer's recent Stripe invoices on /plan.
 *
 * Stripe's hosted Customer Portal remains the canonical place for
 * full invoice history (linked via the "Manage billing" button).
 * This panel is a quick at-a-glance summary so the dealer can see
 * the last few without a portal round-trip — what was billed, when,
 * paid status, and a one-click PDF download per row.
 *
 * Calls billing-list-invoices which uses the caller's
 * tenants.stripe_customer_id to scope the Stripe API request.
 * Returns silently empty when there's no stripe_customer_id yet
 * (pre-checkout state).
 */
const RecentInvoicesPanel = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("billing-list-invoices", {
          body: {},
        });
        if (cancelled) return;
        if (error) throw error;
        setInvoices((data as { invoices?: Invoice[] })?.invoices ?? []);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="border border-border rounded-xl bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading recent invoices…
      </div>
    );
  }

  // Silent on no-customer state — most likely a brand-new dealer
  // pre-checkout. The picker is the right surface for them.
  if (!error && invoices.length === 0) {
    return null;
  }

  if (error) {
    return (
      <div className="border border-border rounded-xl bg-card p-5 text-xs text-muted-foreground">
        Couldn't load invoices ({error}). Use Manage billing for the full history.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent invoices</h3>
        <span className="text-[11px] text-muted-foreground">
          Last {invoices.length} from Stripe · click PDF to download
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-5 py-2 font-medium">Date</th>
            <th className="text-left px-3 py-2 font-medium">Number</th>
            <th className="text-right px-3 py-2 font-medium">Amount</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-right px-5 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((inv) => {
            const paid = inv.status === "paid";
            const open = inv.status === "open";
            return (
              <tr key={inv.id} className="hover:bg-muted/20">
                <td className="px-5 py-2 text-[12px] tabular-nums">
                  {new Date(inv.created).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-[12px] font-mono text-muted-foreground">
                  {inv.number || inv.id}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  ${(inv.amount_paid || inv.amount_due).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2">
                  {paid ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">paid</Badge>
                  ) : open ? (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">open</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>
                  )}
                </td>
                <td className="px-5 py-2 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    {inv.invoice_pdf && (
                      <a href={inv.invoice_pdf} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                          <FileText className="w-3 h-3 mr-1" /> PDF
                        </Button>
                      </a>
                    )}
                    {inv.hosted_invoice_url && (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                          <ExternalLink className="w-3 h-3 mr-1" /> View
                        </Button>
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RecentInvoicesPanel;
