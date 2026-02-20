import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Upload, Copy, FileSpreadsheet, Link2, CheckCircle2, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

interface CustomerRow {
  name: string;
  vin: string;
  date: string;
  time: string;
  link: string;
}

const BASE_DOMAIN = "https://hartecash.lovable.app";

function buildLink(vin: string, date: string, time: string): string {
  const params = new URLSearchParams();
  if (vin) params.set("vin", vin.trim());
  if (date) params.set("date", date.trim());
  if (time) params.set("time", time.trim());
  return `${BASE_DOMAIN}/service?${params.toString()}`;
}

function normaliseDate(raw: string): string {
  if (!raw) return "";
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  // Try MM/DD/YYYY or M/D/YYYY
  const parts = raw.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
    if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
  }
  // Excel serial number
  const serial = Number(raw);
  if (!isNaN(serial) && serial > 30000 && serial < 100000) {
    const d = new Date((serial - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return raw.trim();
}

function parseRows(text: string): CustomerRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Detect header row
  const first = lines[0].toLowerCase();
  const startIdx = /name|vin|date|time/.test(first) ? 1 : 0;

  return lines.slice(startIdx).map((line) => {
    const cols = line.split("\t").length > 1 ? line.split("\t") : line.split(",");
    const name = (cols[0] || "").trim();
    const vin = (cols[1] || "").trim();
    const date = normaliseDate(cols[2] || "");
    const time = (cols[3] || "").trim();
    return { name, vin, date, time, link: buildLink(vin, date, time) };
  });
}

const ServiceLinkGen = () => {
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleParse = () => {
    const parsed = parseRows(pasteText);
    if (parsed.length === 0) {
      toast({ title: "No data found", description: "Paste rows with: Name, VIN, Date, Time (tab or comma separated)", variant: "destructive" });
      return;
    }
    setRows(parsed);
    toast({ title: `${parsed.length} link${parsed.length > 1 ? "s" : ""} generated` });
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      // Detect header
      const firstRow = (json[0] || []).map((c) => String(c).toLowerCase());
      const startIdx = firstRow.some((c) => /name|vin|date|time/.test(c)) ? 1 : 0;
      const parsed: CustomerRow[] = json.slice(startIdx).filter((r) => r.length >= 2 && r.some(Boolean)).map((r) => {
        const name = String(r[0] || "").trim();
        const vin = String(r[1] || "").trim();
        const date = normaliseDate(String(r[2] || ""));
        const time = String(r[3] || "").trim();
        return { name, vin, date, time, link: buildLink(vin, date, time) };
      });
      if (parsed.length === 0) {
        toast({ title: "No valid rows found", variant: "destructive" });
        return;
      }
      setRows(parsed);
      toast({ title: `${parsed.length} link${parsed.length > 1 ? "s" : ""} generated from file` });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, []);

  const copyLink = (link: string, idx: number) => {
    navigator.clipboard.writeText(link);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const copyAll = () => {
    const text = rows.map((r) => `${r.name}\t${r.link}`).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "All links copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Link2 className="w-8 h-8" />
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Service Link Generator</h1>
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Paste customer data or upload an Excel file to generate personalized service landing page links with pre-filled VIN, date &amp; time.
          </p>
        </div>

        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Input Data
            </CardTitle>
            <CardDescription>
              Columns: <strong>Name, VIN, Date, Time</strong> — separated by tabs or commas. Headers are auto-detected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`John Smith\t2T3BFREV5MW123456\t02/21/2026\t9:30 AM\nJane Doe\t1HGBH41JXMN109186\t2026-02-22\t2:00 PM`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleParse} disabled={!pasteText.trim()}>
                Generate Links
              </Button>
              <label>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" asChild>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-1" /> Upload Excel / CSV
                  </span>
                </Button>
              </label>
              {rows.length > 0 && (
                <Button variant="ghost" onClick={() => { setRows([]); setPasteText(""); }}>
                  <Trash2 className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {rows.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{rows.length} Link{rows.length > 1 ? "s" : ""} Generated</CardTitle>
              <Button size="sm" variant="secondary" onClick={copyAll}>
                <Copy className="w-4 h-4 mr-1" /> Copy All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-lg border overflow-hidden">
                {rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{row.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">{row.link}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span>{row.date}</span>
                      <span>{row.time}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={copiedIdx === i ? "default" : "outline"}
                      className="shrink-0"
                      onClick={() => copyLink(row.link, i)}
                    >
                      {copiedIdx === i ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ServiceLinkGen;
