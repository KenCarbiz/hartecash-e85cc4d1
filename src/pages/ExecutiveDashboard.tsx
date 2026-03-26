import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ExecutiveKPIHub from "@/components/admin/ExecutiveKPIHub";

const ExecutiveDashboard = () => {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/admin/login"); return; }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const hasAccess = roles?.some(r => ["admin", "gsm_gm"].includes(r.role));
    if (!hasAccess) { navigate("/admin"); return; }

    setAuthorized(true);
    setLoading(false);
  };

  // Dark mode — respect admin setting
  useEffect(() => {
    const dark = localStorage.getItem("admin-dark-mode") === "true";
    if (dark) document.documentElement.classList.add("dark");
    return () => { document.documentElement.classList.remove("dark"); };
  }, []);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-card-foreground">Executive Overview</h1>
        <button onClick={() => navigate("/admin")} className="text-xs text-muted-foreground hover:text-card-foreground transition-colors">
          ← Back to Admin
        </button>
      </header>
      <ExecutiveKPIHub standalone />
    </div>
  );
};

export default ExecutiveDashboard;
