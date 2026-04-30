import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { History, ExternalLink, Copy, Check, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface DemoRow {
  id: string;
  share_token: string;
  dealer_name: string | null;
  home_url: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const ProspectDemoHistory = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DemoRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prospect_demos")
        .select("id, share_token, dealer_name, home_url, created_at, updated_at, expires_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows((data as DemoRow[]) ?? []);
    } catch (e) {
      toast({
        title: "Couldn't load history",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && rows === null) void load();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = async (token: string) => {
    const url = `${window.location.origin}/demo/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(token);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-800">Run History</span>
          <span className="text-xs text-slate-500">— past Prospect Demo analyses</span>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                void load();
              }}
              disabled={loading}
              className="h-7 px-2 text-xs"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </Button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {loading && rows === null ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
              Loading history…
            </div>
          ) : rows && rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500">
              No saved demos yet. Capture a site and click <em>Save &amp; Share</em> to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Dealer</th>
                    <th className="px-4 py-2 text-left">Homepage</th>
                    <th className="px-4 py-2 text-left">Created</th>
                    <th className="px-4 py-2 text-left">Updated</th>
                    <th className="px-4 py-2 text-left">Expires</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows?.map((r) => {
                    const shareUrl = `${window.location.origin}/demo/${r.share_token}`;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {r.dealer_name || <span className="text-slate-400">Unnamed</span>}
                        </td>
                        <td className="px-4 py-2 text-slate-600 max-w-[220px] truncate">
                          {r.home_url || "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-600" title={new Date(r.created_at).toLocaleString()}>
                          {formatRelative(r.created_at)}
                        </td>
                        <td className="px-4 py-2 text-slate-600" title={new Date(r.updated_at).toLocaleString()}>
                          {formatRelative(r.updated_at)}
                        </td>
                        <td className="px-4 py-2 text-slate-600" title={new Date(r.expires_at).toLocaleString()}>
                          {new Date(r.expires_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => handleCopy(r.share_token)}
                              title="Copy share link"
                            >
                              {copiedId === r.share_token ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                            <a href={shareUrl} target="_blank" rel="noreferrer">
                              <Button variant="ghost" size="sm" className="h-7 px-2" title="Open demo">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProspectDemoHistory;
