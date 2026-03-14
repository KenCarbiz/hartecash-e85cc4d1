import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Car } from "lucide-react";
import harteLogo from "@/assets/harte-logo-white.png";

interface FoundSubmission {
  token: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
}

const CustomerLookup = () => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<FoundSubmission[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !phone.trim()) return;
    setLoading(true);
    const { data } = await supabase.rpc("lookup_submission_by_contact", {
      _email: email.trim(),
      _phone: phone.trim(),
    });
    setResults((data as FoundSubmission[]) || []);
    setSearched(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img src={harteLogo} alt="Harte" className="h-20 w-auto" />
          <h1 className="font-bold text-lg">Find My Submission</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6">
        <div className="text-center mb-6">
          <Search className="w-12 h-12 text-accent mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground mb-1">Look Up Your Submission</h2>
          <p className="text-muted-foreground text-sm">
            Enter the email and phone number you used when submitting your vehicle.
          </p>
        </div>

        <form onSubmit={handleSearch} className="bg-card rounded-xl p-5 shadow-lg space-y-4">
          <div>
            <label className="text-sm font-medium text-card-foreground mb-1 block">Email</label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-card-foreground mb-1 block">Phone Number</label>
            <Input
              type="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
            {loading ? "Searching..." : "Find My Submission"}
          </Button>
        </form>

        {searched && results.length === 0 && (
          <div className="text-center mt-6">
            <p className="text-muted-foreground">No submissions found with that email and phone number.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Make sure you're using the same info you provided when submitting.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-bold text-foreground">Your Submissions</h3>
            {results.map((r) => (
              <button
                key={r.token}
                onClick={() => navigate(`/my-submission/${r.token}`)}
                className="w-full bg-card rounded-xl p-4 shadow border border-border hover:border-accent transition-colors text-left flex items-center gap-3"
              >
                <Car className="w-8 h-8 text-accent flex-shrink-0" />
                <div>
                  <p className="font-bold text-card-foreground">
                    {[r.vehicle_year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ") || "Vehicle"}
                  </p>
                  {r.name && <p className="text-sm text-muted-foreground">{r.name}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Sell Another Vehicle CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">Have another vehicle to sell?</p>
          <a href="/#sell">
            <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent/10 font-bold">
              Sell Another Vehicle
            </Button>
          </a>
        </div>

        <p className="text-center mt-6 text-xs text-muted-foreground">
          🔒 We only show submissions matching your exact contact information.
        </p>
      </div>
    </div>
  );
};

export default CustomerLookup;
