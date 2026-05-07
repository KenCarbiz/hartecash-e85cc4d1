import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Check, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Customer self-check-in page — reached from the appointment-reminder
 * SMS that fires T-3h before the inspection. The SMS includes two
 * one-tap links:
 *
 *   /arrive/<token>?status=on_the_way
 *   /arrive/<token>?status=arrived
 *
 * When the URL has a `status` query param the page auto-fires the
 * RPC and shows the confirmation card. When it doesn't (customer
 * tapped a link that lost the param, or pasted the URL), we render
 * two big buttons so they can pick.
 *
 * Surfaces in real time on FrontDesk + the customer-file slide-out's
 * Greeting Card (item 10) — no front-desk staff hop needed.
 */

type ScreenState = "choose" | "submitting" | "success" | "error";

const CustomerArrival = () => {
  const { token } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const { config } = useSiteConfig();
  const [screen, setScreen] = useState<ScreenState>("choose");
  const [chosen, setChosen] = useState<"on_the_way" | "arrived" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-fire when the SMS link includes ?status=on_the_way|arrived.
  // Without the param the customer landed on the bare /arrive/:token —
  // give them the picker.
  useEffect(() => {
    const initial = search.get("status");
    if (initial === "on_the_way" || initial === "arrived") {
      void submit(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async (status: "on_the_way" | "arrived") => {
    if (!token) {
      setErrorMsg("This link is missing your appointment code.");
      setScreen("error");
      return;
    }
    setChosen(status);
    setScreen("submitting");
    const { error } = await supabase.rpc(
      "customer_self_checkin",
      { _token: token, _status: status } as never,
    );
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("not_found")) {
        setErrorMsg("We couldn't find your appointment. Reach out to the dealership and we'll get you sorted.");
      } else {
        setErrorMsg("Something went sideways on our end. Try again in a moment, or just walk up to the front desk.");
      }
      setScreen("error");
      return;
    }
    setScreen("success");
  };

  const dealerName = config.dealership_name || "the dealership";
  const accent = config.landing_cta_color || "#003b80";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        {screen === "choose" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-info/10 text-info">
                <Car className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Heading to {dealerName}?
              </h1>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                Tap one button so we know you're coming. We'll have your file pulled before you walk in.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => submit("on_the_way")}
                className="w-full h-14 rounded-xl text-base font-bold text-white inline-flex items-center justify-center gap-2 transition active:scale-[0.99]"
                style={{ background: accent }}
              >
                <Car className="w-5 h-5" />
                I'm on my way
              </button>
              <button
                type="button"
                onClick={() => submit("arrived")}
                className="w-full h-14 rounded-xl text-base font-bold inline-flex items-center justify-center gap-2 border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white transition active:scale-[0.99]"
              >
                <MapPin className="w-5 h-5" />
                I've arrived
              </button>
            </div>

            <p className="text-center text-xs text-slate-500 pt-3">
              Either tap is fine — pick whichever fits. You'll get a quick confirmation back.
            </p>
          </motion.div>
        )}

        {screen === "submitting" && (
          <div className="text-center space-y-3 py-12">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-400" />
            <p className="text-sm text-slate-600">Letting them know…</p>
          </div>
        )}

        {screen === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-5 text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/15 text-success">
              <Check className="w-8 h-8" strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {chosen === "arrived" ? "Welcome." : "Got it — see you soon."}
              </h1>
              <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto">
                {chosen === "arrived"
                  ? `The team at ${dealerName} has been pinged. Someone will be with you in a moment — head to the front desk and you can have a seat.`
                  : `We'll have your paperwork pulled and the bay ready when you pull up. Drive safe — and if plans change just text us back.`}
              </p>
            </div>
            {chosen === "on_the_way" && (
              <p className="text-xs text-slate-500 pt-2">
                When you pull in, tap the same link again or text "here" — we'll know.
              </p>
            )}
          </motion.div>
        )}

        {screen === "error" && (
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warning/15 text-warning">
              <Car className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              We hit a snag
            </h1>
            <p className="text-sm text-slate-600 max-w-sm mx-auto">{errorMsg}</p>
            <button
              type="button"
              onClick={() => { setScreen("choose"); setErrorMsg(""); }}
              className="text-sm font-semibold text-info hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerArrival;
