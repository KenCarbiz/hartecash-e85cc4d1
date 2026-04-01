import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Upload, Copy, FileSpreadsheet, Link2, CheckCircle2, Trash2, Sun, Moon } from "lucide-react";
// @ts-ignore - read-excel-file browser entry
import readXlsxFile from "read-excel-file/browser";
import serviceLogo from "@/assets/harte-service-logo.png";

interface CustomerRow {
  name: string;
  vin: string;
  date: string;
  time: string;
  link: string;
}

const BASE_DOMAIN = "https://hartecash.com";

function buildLink(vin: string, date: string, time: string): string {
  const parts: string[] = [];
  if (vin) parts.push(`vin=${vin.trim()}`);
  if (date) parts.push(`date=${date.trim()}`);
  if (time) parts.push(`time=${time.trim().replace(/ /g, "%20")}`);
  return `${BASE_DOMAIN}/service?${parts.join("&")}`;
}

function normaliseDate(raw: string): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  const parts = raw.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
    if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
  }
  const serial = Number(raw);
  if (!isNaN(serial) && serial > 30000 && serial < 100000) {
    const d = new Date((serial - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return raw.trim();
}

function parseRows(text: string): CustomerRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
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
  const [copied, setCopied] = useState<{ idx: number; field: "link" | "name" } | null>(null);
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem("slg-dark");
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem("slg-dark", String(dark));
  }, [dark]);

  // Theme tokens
  const t = dark
    ? {
        page: "bg-[hsl(222,47%,6%)] text-white",
        header: "border-b border-[hsl(217,33%,17%)]",
        headerLabel: "text-[hsl(215,20%,65%)]",
        heroBg: "from-[hsl(210,100%,25%)]/20",
        heroGlow: "bg-[hsl(210,100%,25%)]/10",
        title: "text-white",
        subtitle: "text-[hsl(215,20%,65%)]",
        card: "bg-[hsl(222,47%,8%)] border border-[hsl(217,33%,17%)]",
        cardTitle: "text-white",
        cardDesc: "text-[hsl(215,20%,65%)]",
        strongText: "text-white/80",
        textarea: "bg-[hsl(222,47%,6%)] border-[hsl(217,33%,17%)] text-white placeholder:text-[hsl(215,20%,40%)] focus-visible:ring-[hsl(210,80%,60%)]/50",
        btnPrimary: "bg-[hsl(210,80%,55%)] hover:bg-[hsl(210,80%,45%)] text-white font-semibold",
        btnOutline: "border-[hsl(217,33%,17%)] text-[hsl(215,20%,75%)] hover:bg-[hsl(217,33%,17%)]/50 hover:text-white",
        btnGhost: "text-[hsl(215,20%,65%)] hover:text-white hover:bg-white/5",
        divider: "divide-[hsl(217,33%,17%)]",
        rowHover: "hover:bg-white/[0.03]",
        linkText: "text-[hsl(210,80%,60%)]",
        metaText: "text-[hsl(215,20%,65%)]",
        copyBtn: "border-[hsl(217,33%,17%)] text-[hsl(215,20%,75%)] hover:bg-[hsl(217,33%,17%)]/50 hover:text-white bg-transparent border",
        copyBtnDone: "bg-[hsl(160,84%,39%)] hover:bg-[hsl(160,84%,39%)] text-white",
        toggleBtn: "bg-white/10 hover:bg-white/20 text-white border-white/20",
      }
    : {
        page: "bg-[hsl(210,20%,96%)] text-[hsl(222,47%,15%)]",
        header: "border-b border-[hsl(215,20%,85%)] bg-white shadow-sm",
        headerLabel: "text-[hsl(215,20%,50%)]",
        heroBg: "from-[hsl(210,60%,92%)]",
        heroGlow: "bg-[hsl(210,80%,90%)]/60",
        title: "text-[hsl(222,47%,15%)]",
        subtitle: "text-[hsl(215,20%,45%)]",
        card: "bg-white border border-[hsl(215,20%,88%)] shadow-sm",
        cardTitle: "text-[hsl(222,47%,15%)]",
        cardDesc: "text-[hsl(215,20%,50%)]",
        strongText: "text-[hsl(222,47%,20%)]",
        textarea: "bg-[hsl(210,20%,98%)] border-[hsl(215,20%,85%)] text-[hsl(222,47%,15%)] placeholder:text-[hsl(215,20%,65%)] focus-visible:ring-[hsl(210,80%,55%)]/50",
        btnPrimary: "bg-[hsl(210,80%,50%)] hover:bg-[hsl(210,80%,42%)] text-white font-semibold",
        btnOutline: "border-[hsl(215,20%,80%)] text-[hsl(222,47%,30%)] hover:bg-[hsl(215,20%,93%)] hover:text-[hsl(222,47%,15%)]",
        btnGhost: "text-[hsl(215,20%,50%)] hover:text-[hsl(222,47%,15%)] hover:bg-[hsl(215,20%,93%)]",
        divider: "divide-[hsl(215,20%,88%)]",
        rowHover: "hover:bg-[hsl(210,20%,96%)]",
        linkText: "text-[hsl(210,80%,45%)]",
        metaText: "text-[hsl(215,20%,50%)]",
        copyBtn: "border-[hsl(215,20%,80%)] text-[hsl(222,47%,30%)] hover:bg-[hsl(215,20%,88%)] bg-transparent border",
        copyBtnDone: "bg-[hsl(160,84%,39%)] hover:bg-[hsl(160,84%,39%)] text-white",
        toggleBtn: "bg-[hsl(215,20%,90%)] hover:bg-[hsl(215,20%,85%)] text-[hsl(222,47%,20%)] border-[hsl(215,20%,80%)]",
      };

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
    
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    
    const processRows = (json: (string | null)[][]) => {
      const firstRow = (json[0] || []).map((c) => String(c ?? "").toLowerCase());
      const startIdx = firstRow.some((c) => /name|vin|date|time/.test(c)) ? 1 : 0;
      const parsed: CustomerRow[] = json.slice(startIdx).filter((r) => r.length >= 2 && r.some(Boolean)).map((r) => {
        const name = String(r[0] ?? "").trim();
        const vin = String(r[1] ?? "").trim();
        const date = normaliseDate(String(r[2] ?? ""));
        const time = String(r[3] ?? "").trim();
        return { name, vin, date, time, link: buildLink(vin, date, time) };
      });
      if (parsed.length === 0) {
        toast({ title: "No valid rows found", variant: "destructive" });
        return;
      }
      setRows(parsed);
      toast({ title: `${parsed.length} link${parsed.length > 1 ? "s" : ""} generated from file` });
    };

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const json = lines.map(line => {
          const cells: string[] = [];
          let current = '';
          let inQuotes = false;
          for (const char of line) {
            if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { cells.push(current); current = ''; }
            else { current += char; }
          }
          cells.push(current);
          return cells;
        });
        processRows(json);
      };
      reader.readAsText(file);
    } else {
      readXlsxFile(file).then((rows: any[][]) => {
        const json = rows.map(row => row.map(cell => cell != null ? String(cell) : null));
        processRows(json);
      }).catch(() => {
        toast({ title: "Failed to read file", variant: "destructive" });
      });
    }
    e.target.value = "";
  }, []);

  const copyField = (text: string, idx: number, field: "link" | "name") => {
    navigator.clipboard.writeText(text);
    setCopied({ idx, field });
    setTimeout(() => setCopied(null), 1500);
  };

  const isCopied = (idx: number, field: "link" | "name") =>
    copied?.idx === idx && copied?.field === field;

  const copyAll = () => {
    const text = rows.map((r) => `${r.name}\t${r.link}`).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "All links copied to clipboard" });
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${t.page}`}>
      {/* Header */}
      <header className={t.header}>
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <img src={serviceLogo} alt="Harte Auto Group" className="h-32 -my-8" />
          <div className="flex items-center gap-4">
            <span className={`text-sm font-semibold tracking-wider uppercase ${t.headerLabel}`}>Link Generator</span>
            <button
              onClick={() => setDark((d) => !d)}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${t.toggleBtn}`}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-14 pb-10 text-center">
        <div className={`absolute inset-0 bg-gradient-to-b ${t.heroBg} via-transparent to-transparent pointer-events-none`} />
        <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full ${t.heroGlow} blur-[150px] pointer-events-none`} />
        <div className="relative">
          <div className="inline-flex items-center gap-3 mb-4">
            <Link2 className="w-8 h-8 text-[hsl(210,80%,60%)]" />
            <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${t.title}`}>Service Link Generator</h1>
          </div>
          <p className={`max-w-xl mx-auto text-lg ${t.subtitle}`}>
            Paste customer data or upload an Excel file to generate personalized service landing page links with pre-filled VIN, date &amp; time.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 pb-16 space-y-8">
        {/* Input Section */}
        <div className={`${t.card} rounded-2xl p-6 md:p-8 shadow-lg transition-colors duration-300`}>
          <h2 className={`text-lg font-bold flex items-center gap-2 mb-1 ${t.cardTitle}`}>
            <FileSpreadsheet className="w-5 h-5 text-[hsl(210,80%,60%)]" />
            Input Data
          </h2>
          <p className={`text-sm mb-5 ${t.cardDesc}`}>
            Columns: <strong className={t.strongText}>Name, VIN, Date, Time</strong> — separated by tabs or commas. Headers are auto-detected.
          </p>
          <Textarea
            placeholder={`John Smith\t1N4BL4CW9PN393264\t02/21/2026\t10:00 AM\nJane Doe\t1HGBH41JXMN109186\t2026-02-22\t2:00 PM`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className={`font-mono text-sm mb-4 ${t.textarea}`}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleParse} disabled={!pasteText.trim()} className={t.btnPrimary}>
              Generate Links
            </Button>
            <label>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" asChild className={t.btnOutline}>
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-1" /> Upload Excel / CSV
                </span>
              </Button>
            </label>
            {rows.length > 0 && (
              <Button variant="ghost" onClick={() => { setRows([]); setPasteText(""); }} className={t.btnGhost}>
                <Trash2 className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        {rows.length > 0 && (
          <div className={`${t.card} rounded-2xl shadow-lg overflow-hidden transition-colors duration-300`}>
            <div className={`flex items-center justify-between px-6 py-5 border-b ${dark ? "border-[hsl(217,33%,17%)]" : "border-[hsl(215,20%,88%)]"}`}>
              <h2 className={`text-lg font-bold ${t.cardTitle}`}>{rows.length} Link{rows.length > 1 ? "s" : ""} Generated</h2>
              <Button size="sm" onClick={copyAll} className={t.btnPrimary}>
                <Copy className="w-4 h-4 mr-1" /> Copy All
              </Button>
            </div>
            <div className={`divide-y ${t.divider}`}>
              {rows.map((row, i) => (
                <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 transition-colors ${t.rowHover}`}>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${t.cardTitle}`}>{row.name || "—"}</p>
                    <p className={`text-xs truncate font-mono mt-0.5 ${t.linkText}`}>{row.link}</p>
                    {(row.date || row.time) && (
                      <p className={`text-xs mt-0.5 ${t.metaText}`}>{row.date}{row.date && row.time ? " · " : ""}{row.time}</p>
                    )}
                  </div>
                  {/* Copy buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {row.name && (
                      <Button
                        size="sm"
                        title="Copy name"
                        className={`shrink-0 text-xs px-2 ${isCopied(i, "name") ? t.copyBtnDone : t.copyBtn}`}
                        onClick={() => copyField(row.name, i, "name")}
                      >
                        {isCopied(i, "name") ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline ml-1">Name</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      title="Copy URL"
                      className={`shrink-0 text-xs px-2 ${isCopied(i, "link") ? t.copyBtnDone : t.copyBtn}`}
                      onClick={() => copyField(row.link, i, "link")}
                    >
                      {isCopied(i, "link") ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline ml-1">URL</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceLinkGen;
