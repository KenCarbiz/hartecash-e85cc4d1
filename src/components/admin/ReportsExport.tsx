import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStatusLabel } from "@/lib/adminConstants";

const SOURCE_LABELS: Record<string, string> = {
  inventory: "Off Street",
  service: "Service Drive",
  trade: "Trade-In",
  in_store_trade: "In-Store Trade",
};

const ReportsExport = () => {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const exportCSV = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select("created_at, name, email, phone, vehicle_year, vehicle_make, vehicle_model, vin, mileage, overall_condition, progress_status, lead_source, offered_price, acv_value, estimated_offer_low, estimated_offer_high, photos_uploaded, docs_uploaded, is_hot_lead, zip, store_location_id, status_updated_at")
        .order("created_at", { ascending: false });

      if (error || !data) {
        toast({ title: "Export failed", variant: "destructive" });
        return;
      }

      const headers = [
        "Date", "Name", "Email", "Phone", "Year", "Make", "Model", "VIN",
        "Mileage", "Condition", "Status", "Source", "Offered Price", "ACV",
        "Est. Low", "Est. High", "Photos", "Docs", "Hot Lead", "ZIP", "Last Updated"
      ];

      const rows = data.map((s: any) => [
        new Date(s.created_at).toLocaleDateString(),
        s.name || "",
        s.email || "",
        s.phone || "",
        s.vehicle_year || "",
        s.vehicle_make || "",
        s.vehicle_model || "",
        s.vin || "",
        s.mileage || "",
        s.overall_condition || "",
        getStatusLabel(s.progress_status),
        SOURCE_LABELS[s.lead_source] || s.lead_source || "",
        s.offered_price || "",
        s.acv_value || "",
        s.estimated_offer_low || "",
        s.estimated_offer_high || "",
        s.photos_uploaded ? "Yes" : "No",
        s.docs_uploaded ? "Yes" : "No",
        s.is_hot_lead ? "Yes" : "No",
        s.zip || "",
        s.status_updated_at ? new Date(s.status_updated_at).toLocaleDateString() : "",
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `submissions-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Export complete", description: `${data.length} records exported.` });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-card-foreground">Reports & Export</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
            <div>
              <h3 className="font-semibold text-card-foreground">Submissions Export</h3>
              <p className="text-xs text-muted-foreground">Download all lead data as CSV</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Exports all submissions with contact info, vehicle details, status, pricing, and lead source. Compatible with Excel, Google Sheets, and most CRM imports.
          </p>
          <Button onClick={exportCSV} disabled={exporting} className="w-full gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportsExport;
