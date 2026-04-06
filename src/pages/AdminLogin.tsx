import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Shield, Eye, EyeOff } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const getSafeAuthError = (message: string, isSignup: boolean): string => {
  const map: Record<string, string> = {
    "Invalid login credentials": "Invalid email or password.",
    "Email not confirmed": "Please verify your email address before signing in.",
    "User already registered": "Unable to create account. Please try signing in instead.",
    "Password should be at least 6 characters": "Password does not meet the minimum requirements.",
    "Email rate limit exceeded": "Too many attempts. Please try again later.",
    "Signup requires a valid password": "Password does not meet the minimum requirements.",
  };
  return map[message] || (isSignup ? "Unable to create account. Please try again." : "Invalid email or password.");
};

const AdminLogin = () => {
  const { config } = useSiteConfig();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isSignup) {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) {
        setError(getSafeAuthError(authError.message, true));
        setLoading(false);
        return;
      }

      if (data.user) {
        const { error: reqError } = await supabase.from("pending_admin_requests").insert({
          user_id: data.user.id,
          email,
        });
        if (reqError) {
          setError("Failed to submit access request.");
          setLoading(false);
          return;
        }
      }

      setError("");
      setEmail("");
      setPassword("");
      setIsSignup(false);
      alert("Account created! Your request has been sent to the admin for approval.");
    } else {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(getSafeAuthError(authError.message, false));
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .limit(1)
        .maybeSingle();

      if (!roleData) {
        const { data: pendingData } = await supabase
          .from("pending_admin_requests")
          .select("status")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingData?.status === "pending") {
          setError("Your access request is pending approval.");
        } else if (pendingData?.status === "rejected") {
          setError("Your access request was denied.");
        } else {
          setError("You do not have access.");
        }
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      navigate("/admin");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[hsl(210,100%,8%)] via-[hsl(215,90%,12%)] to-[hsl(220,80%,10%)]">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(hsl(210,100%,25%,0.15)_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />
      
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Glass card */}
        <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-[0_25px_80px_-20px_hsl(var(--primary)/0.3)] border border-border/50 p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.dealership_name} className="h-20 w-auto" />
            ) : (
              <h2 className="text-2xl font-bold text-card-foreground">{config.dealership_name}</h2>
            )}
          </div>

          {/* Title */}
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-card-foreground leading-tight">
                {isSignup ? "Create Account" : "Staff Portal"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isSignup ? "Request admin access" : "Secure sign in"}
              </p>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-muted/50 border-border/60 focus:border-primary/50 focus:ring-primary/20 transition-all"
                placeholder="you@dealership.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-muted/50 border-border/60 focus:border-primary/50 focus:ring-primary/20 transition-all pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-card-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                <Shield className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            >
              {loading ? (isSignup ? "Creating account..." : "Signing in...") : (isSignup ? "Create Account" : "Sign In")}
            </Button>
          </form>

          {!isSignup && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={async () => {
                  if (!email) {
                    setError("Enter your email above, then click Forgot Password.");
                    return;
                  }
                  setLoading(true);
                  setError("");
                  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + "/reset-password",
                  });
                  setLoading(false);
                  if (resetErr) {
                    setError("Unable to send reset email. Please try again.");
                  } else {
                    setError("");
                    alert("Password reset email sent! Check your inbox.");
                  }
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              {isSignup ? "Already have an account?" : "Need an account?"}{" "}
              <button
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError("");
                }}
                className="text-primary font-semibold hover:underline"
              >
                {isSignup ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 mt-4 text-[11px] text-primary-foreground/30">
          <Shield className="w-3 h-3" />
          <span>256-bit encrypted · Enterprise grade</span>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
