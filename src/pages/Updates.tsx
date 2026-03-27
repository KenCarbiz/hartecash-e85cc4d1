import { useState, useEffect } from "react";
import { ArrowLeft, Sparkles, Shield, Bell, BarChart3, Wrench, Camera, FileText, Users, DollarSign, CheckCircle, ChevronDown, ChevronRight, MapPin, Smartphone, CalendarDays, MessageSquare, Star, Eye, Handshake, ClipboardCheck, ScanLine, Car, ImagePlus, Loader, SplitSquareHorizontal, FormInput, Layout, Moon, Zap, Globe, Palette, Database, ClipboardList, QrCode, Layers, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ChangelogEntry {
  id: string;
  entry_date: string;
  title: string;
  description: string;
  items: string[];
  icon: string;
  tag: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  ClipboardCheck, ScanLine, SplitSquareHorizontal, ImagePlus, Loader,
  DollarSign, Eye, Shield, Bell, MessageSquare, CheckCircle, Handshake,
  BarChart3, FileText, Camera, CalendarDays, Users, Star, MapPin,
  Smartphone, Wrench, Layout, Globe, Moon, Zap, QrCode, Database,
  ClipboardList, FormInput, Layers, Car, Palette, Sparkles,
};

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

export default function Updates() {
  const navigate = useNavigate();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredEntries = activeFilter
    ? entries.filter((e) => e.tag === activeFilter)
    : entries;

  useEffect(() => {
    supabase
      .from("changelog_entries")
      .select("id, entry_date, title, description, items, icon, tag")
      .eq("is_active", true)
      .order("entry_date", { ascending: false })
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setEntries((data as ChangelogEntry[]) || []);
        setLoading(false);
      });
  }, []);

  const getIcon = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName] || Sparkles;
    return <IconComponent className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-background">
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

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["feature", "improvement", "fix", "security"] as const).map((tag) => {
            const count = entries.filter((e) => e.tag === tag).length;
            if (count === 0) return null;
            const isActive = activeFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setActiveFilter(isActive ? null : tag)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  isActive
                    ? `${TAG_STYLES[tag]} border-current`
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {TAG_LABELS[tag]} ({count})
              </button>
            );
          })}
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="text-xs text-muted-foreground underline underline-offset-2 ml-1 self-center"
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="pl-12 py-4">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-5 w-64 mb-1" />
                <Skeleton className="h-3 w-96" />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
            <div className="space-y-1">
              {filteredEntries.map((entry, idx) => {
                const isExpanded = expandedIdx === idx;
                return (
                  <div key={entry.id} className="relative pl-12">
                    <div className={`absolute left-2.5 top-5 w-3 h-3 rounded-full border-2 transition-colors ${isExpanded ? "bg-primary border-primary" : "bg-background border-muted-foreground/30"}`} />
                    <button
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      className="w-full text-left py-4 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 p-2 rounded-lg transition-colors ${isExpanded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {getIcon(entry.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">
                              {new Date(entry.entry_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TAG_STYLES[entry.tag] || TAG_STYLES.feature}`}>
                              {TAG_LABELS[entry.tag] || entry.tag}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-foreground mt-1 group-hover:text-primary transition-colors">
                            {entry.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                        </div>
                        <div className="shrink-0 mt-1 text-muted-foreground">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="pb-4 -mt-1">
                        <ul className="space-y-1.5 ml-12">
                          {entry.items.map((item, i) => (
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
        )}

        {!loading && (
          <p className="text-center text-xs text-muted-foreground mt-12 pb-8">
            — End of changelog —
          </p>
        )}
      </main>
    </div>
  );
}
