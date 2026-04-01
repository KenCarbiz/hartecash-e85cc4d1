import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

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
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isSignup) {
      // Sign up
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

      // Create pending admin request
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
      // Log in
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(getSafeAuthError(authError.message, false));
        setLoading(false);
        return;
      }

      // Check if user has any staff role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .limit(1)
        .maybeSingle();

      if (!roleData) {
        // Check if they have a pending request
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <h2 className="text-2xl font-black tracking-tight text-primary font-display">AutoCurb<span className="text-accent">.io</span></h2>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-bold text-card-foreground">{isSignup ? "Create Admin Account" : "Admin Login"}</h1>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? (isSignup ? "Creating account..." : "Signing in...") : (isSignup ? "Create Account" : "Sign In")}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "Need an account?"}{" "}
            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
              }}
              className="text-primary font-medium hover:underline"
            >
              {isSignup ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
