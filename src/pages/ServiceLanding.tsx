import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ArrowRight, CheckCircle, Loader2, Car, CalendarDays,
  Wrench, DollarSign, Clock, Star, RefreshCw, ShieldCheck, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import serviceLogo from "@/assets/harte-service-logo.png";

interface VehicleInfo {
  year: string;
  make: string;
  model: string;
}

const decodeVin = async (vin: string): Promise<VehicleInfo | null> => {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`
    );
    const data = await res.json();
    const results = data.Results as { Variable: string; Value: string | null }[];
    const get = (name: string) => results.find((r) => r.Variable === name)?.Value || "";
    const year = get("Model Year");
    const make = get("Make");
    const model = get("Model");
    if (year && make && model) return { year, make, model };
    return null;
  } catch {
    return null;
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const benefits = [
  {
    icon: <RefreshCw className="w-6 h-6" />,
    title: "Restart Your Warranty",
    desc: "Trade into a newer model with full factory warranty coverage. No more surprise repair bills.",
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Your Car's Value Is at Its Peak",
    desc: "Vehicle values depreciate every day. Right now, your car is worth more than it will be tomorrow.",
  },
  {
    icon: <Wrench className="w-6 h-6" />,
    title: "Skip the Costly Repairs",
    desc: "Instead of spending thousands on upcoming maintenance, put that money toward a newer, more reliable vehicle.",
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: "We Know Your Vehicle",
    desc: "Since we've serviced your car, we know its full history — which means we can offer you top dollar with confidence.",
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: "Top Dollar, Guaranteed",
    desc: "Our offers are based on real-time market data. No lowball numbers. No games.",
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: "Done in One Visit",
    desc: "You're already coming in for service. We handle the appraisal and paperwork while you wait.",
  },
];

const ServiceLanding = () => {
  const [searchParams] = useSearchParams();
  const vinParam = searchParams.get("vin") || "";
  const appointmentDate = searchParams.get("date") || "";
  const appointmentTime = searchParams.get("time") || "";

  const formattedAppointment = (() => {
    if (!appointmentDate) return null;
    try {
      const [year, month, day] = appointmentDate.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const dateStr = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      return appointmentTime ? `${dateStr} at ${decodeURIComponent(appointmentTime)}` : dateStr;
    } catch {
      return appointmentTime ? `${appointmentDate} at ${decodeURIComponent(appointmentTime)}` : appointmentDate;
    }
  })();

  const [step, setStep] = useState(0); // 0 = vehicle, 1 = contact, 2 = done
  const [vin, setVin] = useState(vinParam.trim().toUpperCase());
  const [mileage, setMileage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const vehicleLabel = vehicleInfo ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}` : null;

  // Auto-decode VIN from URL param on mount
  useEffect(() => {
    const trimmedVin = vinParam.trim();
    if (trimmedVin && trimmedVin.length === 17) {
      setVinLoading(true);
      decodeVin(trimmedVin).then((info) => {
        setVinLoading(false);
        if (info) setVehicleInfo(info);
      });
    }
  }, [vinParam]);

  const handleVinLookup = async () => {
    const trimmedVin = vin.trim();
    if (trimmedVin.length !== 17) {
      setVinError("VIN must be exactly 17 characters.");
      return;
    }
    setVin(trimmedVin);
    setVinError("");
    setVinLoading(true);
    setVehicleInfo(null);
    const info = await decodeVin(trimmedVin);
    setVinLoading(false);
    if (info) setVehicleInfo(info);
    else setVinError("Could not decode this VIN. Please check and try again.");
  };

  const handleStep1 = () => {
    if (!vin.trim() || !mileage.trim()) {
      toast({ title: "Please complete all fields", description: "VIN and mileage are required.", variant: "destructive" });
      return;
    }
    if (vin.length !== 17) {
      toast({ title: "Invalid VIN", description: "VIN must be exactly 17 characters.", variant: "destructive" });
      return;
    }
    setStep(1);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    if (!name.trim() || !phone.trim() || !email.trim()) {
      toast({ title: "Please complete all fields", description: "Name, phone, and email are required.", variant: "destructive" });
      return;
    }
    const lastSubmit = localStorage.getItem("lastSubmissionTime");
    if (lastSubmit && Date.now() - parseInt(lastSubmit) < 120000) {
      toast({ title: "Please wait", description: "You recently submitted. Please wait a couple of minutes.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const generatedToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      const hasScheduledAppointment = !!(appointmentDate && appointmentTime);

      const { error } = await supabase.from("submissions").insert({
        token: generatedToken,
        vin: vin || null,
        mileage: mileage || null,
        vehicle_year: vehicleInfo?.year || null,
        vehicle_make: vehicleInfo?.make || null,
        vehicle_model: vehicleInfo?.model || null,
        name: name || null,
        phone: phone || null,
        email: email || null,
        next_step: "service_trade",
        loan_status: "sell",
        lead_source: "service",
        appointment_date: appointmentDate || null,
        appointment_set: hasScheduledAppointment,
        progress_status: hasScheduledAppointment ? "inspection_scheduled" : "new",
        internal_notes: appointmentDate
          ? `Service appointment: ${formattedAppointment}. Submitted via service trade landing page.`
          : "Submitted via service trade landing page.",
      });

      if (error) throw error;

      // If the customer has a pre-populated service appointment, create an appointment record
      if (hasScheduledAppointment) {
        const vehicleDesc = vehicleInfo
          ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`
          : vin || "Unknown vehicle";

        await supabase.from("appointments").insert({
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          preferred_date: appointmentDate,
          preferred_time: decodeURIComponent(appointmentTime),
          vehicle_info: vehicleDesc,
          submission_token: generatedToken,
          status: "confirmed",
          notes: `Auto-created from service appointment. Appraisal scheduled during service visit on ${formattedAppointment}.`,
        });
      }

      setUploadUrl(`${window.location.origin}/upload/${generatedToken}`);
      localStorage.setItem("lastSubmissionTime", Date.now().toString());
      setStep(2);
    } catch {
      toast({ title: "Submission failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,5%)] text-[hsl(210,40%,98%)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(222,47%,5%)]/90 backdrop-blur-md border-b border-[hsl(217,33%,17%)] overflow-visible">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <img src={serviceLogo} alt="Harte Auto Group" className="h-32 -my-8" />
          <span className="text-sm font-semibold text-[hsl(215,20%,65%)] tracking-wider uppercase">Service Customer Exclusive</span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-16 pb-20 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(210,100%,25%)]/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(210,100%,25%)]/10 blur-[150px] pointer-events-none" />

        <motion.div initial="hidden" animate="visible" className="relative max-w-2xl mx-auto">



          <motion.h1 variants={fadeUp} custom={1} className="text-3xl md:text-5xl lg:text-6xl font-black leading-tight mb-6 tracking-tight">
             {vehicleLabel ? (
              <>
                Your{" "}
                <span className="bg-gradient-to-r from-[hsl(210,80%,60%)] to-[hsl(250,80%,70%)] bg-clip-text text-transparent">
                  {vehicleInfo!.year} {vehicleInfo!.make}
                </span>{" "}
                Could Be Worth More Than You Think to Trade Up or Sell
              </>
            ) : (
              <>
                There's Never Been a{" "}
                <span className="bg-gradient-to-r from-[hsl(210,80%,60%)] to-[hsl(250,80%,70%)] bg-clip-text text-transparent">
                  Better Time
                </span>{" "}
                to Upgrade or Sell
              </>
            )}
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-[hsl(215,20%,65%)] mb-10 leading-relaxed max-w-xl mx-auto">
            {formattedAppointment
              ? `While you're here on ${formattedAppointment.split(" at")[0]} for service, let us show you what your ${vehicleLabel || "vehicle"} is worth — it only takes 2 minutes.`
              : `You're already trusting us with your vehicle's care. Let us show you what it's worth — and how easy upgrading can be.`}
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex items-center justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            ))}
            <span className="ml-2 text-sm font-semibold">4.9</span>
            <span className="text-sm text-[hsl(215,20%,65%)]">• 2,400+ happy sellers</span>
          </motion.div>
        </motion.div>
      </section>

      {/* Form Card */}
      <section className="px-5 -mt-6 pb-16 relative z-10" ref={formRef}>
        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-[hsl(222,47%,8%)] border border-[hsl(217,33%,17%)] rounded-2xl p-6 md:p-8 shadow-2xl"
              >
                <h2 className="text-xl font-bold mb-1">Your Vehicle</h2>
                <p className="text-sm text-[hsl(215,20%,65%)] mb-4">
                  {vehicleInfo
                    ? "We found your vehicle. Just confirm the mileage below."
                    : "Your VIN is pre-filled. Hit Lookup to confirm your vehicle."}
                </p>

                {formattedAppointment && (
                  <div className="flex items-center gap-3 p-3 bg-[hsl(160,84%,39%)]/10 border border-[hsl(160,84%,39%)]/30 rounded-lg mb-5 text-sm">
                    <CalendarDays className="w-5 h-5 text-[hsl(160,60%,60%)] flex-shrink-0" />
                    <div>
                      <span className="text-[hsl(160,60%,60%)]">Your Service Appointment</span>
                      <p className="font-semibold text-[hsl(160,60%,75%)]">{formattedAppointment}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[hsl(215,20%,75%)]">VIN Number</label>
                    <div className="flex gap-2">
                      <Input
                        value={vin}
                        onChange={(e) => { setVin(e.target.value.toUpperCase()); setVehicleInfo(null); setVinError(""); }}
                        maxLength={17}
                        placeholder="17-character VIN"
                        className="flex-1 bg-[hsl(222,47%,12%)] border-[hsl(217,33%,22%)] text-[hsl(210,40%,98%)] placeholder:text-[hsl(215,20%,45%)]"
                      />
                      <Button
                        type="button"
                        onClick={handleVinLookup}
                        disabled={vinLoading || vin.length === 0}
                        className="bg-[hsl(210,100%,25%)] hover:bg-[hsl(210,100%,30%)] text-[hsl(0,0%,100%)] shrink-0"
                      >
                        {vinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
                      </Button>
                    </div>
                    {vinError && <p className="text-[hsl(0,84%,60%)] text-sm mt-2">{vinError}</p>}
                  </div>

                  {vehicleInfo && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-[hsl(160,84%,39%)]/10 border border-[hsl(160,84%,39%)]/30 rounded-xl"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-5 h-5 text-success" />
                        <span className="text-sm font-bold">Vehicle Found</span>
                      </div>
                      <p className="text-lg font-semibold">{vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}</p>
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[hsl(215,20%,75%)]">Current Mileage</label>
                    <Input
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      placeholder="e.g. 45,000"
                      className="bg-[hsl(222,47%,12%)] border-[hsl(217,33%,22%)] text-[hsl(210,40%,98%)] placeholder:text-[hsl(215,20%,45%)]"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleStep1}
                    className="w-full py-5 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/20 hover:-translate-y-0.5 transition-all"
                  >
                    See What It's Worth <ArrowRight className="w-5 h-5 ml-1" />
                  </Button>
                  <p className="text-center text-xs text-[hsl(215,20%,50%)] mt-3 flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Takes about 2 minutes • No obligation
                  </p>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-[hsl(222,47%,8%)] border border-[hsl(217,33%,17%)] rounded-2xl p-6 md:p-8 shadow-2xl"
              >
                <h2 className="text-xl font-bold mb-1">Almost There</h2>
                <p className="text-sm text-[hsl(215,20%,65%)] mb-6">
                  Tell us where to send your personalized offer.
                </p>

                {vehicleInfo && (
                  <div className="p-3 bg-[hsl(210,100%,25%)]/10 border border-[hsl(210,100%,25%)]/20 rounded-lg mb-5 text-sm">
                    <span className="font-semibold">{vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}</span>
                    <span className="text-[hsl(215,20%,65%)] ml-2">• {mileage} mi</span>
                  </div>
                )}

                {formattedAppointment && (
                  <div className="flex items-center gap-3 p-3 bg-[hsl(160,84%,39%)]/10 border border-[hsl(160,84%,39%)]/30 rounded-lg mb-5 text-sm">
                    <CalendarDays className="w-5 h-5 text-[hsl(160,60%,60%)] flex-shrink-0" />
                    <div>
                      <span className="text-[hsl(160,60%,60%)]">Service Appointment</span>
                      <p className="font-semibold text-[hsl(160,60%,75%)]">{formattedAppointment}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
                    style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }} tabIndex={-1} autoComplete="off" />

                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[hsl(215,20%,75%)]">Full Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith"
                      className="bg-[hsl(222,47%,12%)] border-[hsl(217,33%,22%)] text-[hsl(210,40%,98%)] placeholder:text-[hsl(215,20%,45%)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[hsl(215,20%,75%)]">Phone Number</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567"
                      className="bg-[hsl(222,47%,12%)] border-[hsl(217,33%,22%)] text-[hsl(210,40%,98%)] placeholder:text-[hsl(215,20%,45%)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[hsl(215,20%,75%)]">Email Address</label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@email.com" type="email"
                      className="bg-[hsl(222,47%,12%)] border-[hsl(217,33%,22%)] text-[hsl(210,40%,98%)] placeholder:text-[hsl(215,20%,45%)]" />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setStep(0)}
                      className="flex-1 py-4 bg-transparent border-[hsl(217,33%,22%)] text-[hsl(210,40%,98%)] hover:bg-[hsl(222,47%,12%)]">
                      Back
                    </Button>
                    <Button type="submit" disabled={submitting}
                      className="flex-1 py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/20 hover:-translate-y-0.5 transition-all">
                      {submitting ? "Submitting..." : "Get My Offer →"}
                    </Button>
                  </div>
                </form>

                <p className="text-center mt-4 text-xs text-[hsl(215,20%,50%)]">🔒 Your information is 100% secure and never shared.</p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-[hsl(222,47%,8%)] border border-[hsl(217,33%,17%)] rounded-2xl p-6 md:p-8 shadow-2xl text-center"
              >
                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-success" />
                </div>
                <h2 className="text-2xl font-bold mb-2">You're All Set, {name.split(" ")[0]}!</h2>
                <p className="text-[hsl(215,20%,65%)] mb-6">
                  We're preparing your personalized offer for your{" "}
                  {vehicleInfo ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}` : "vehicle"}.
                  We'll reach out shortly.
                </p>

                <div className="bg-[hsl(222,47%,12%)] border border-[hsl(217,33%,22%)] rounded-xl p-5 mb-6 text-left">
                  <h3 className="text-sm font-bold mb-3 text-[hsl(215,20%,75%)]">Want to Speed Things Up?</h3>
                  <p className="text-sm text-[hsl(215,20%,65%)] mb-4">
                    Upload a few photos of your vehicle so we can give you the most accurate offer possible.
                  </p>
                  <a href={uploadUrl} className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(210,80%,60%)] hover:text-[hsl(210,80%,70%)] transition-colors">
                    Upload Photos <ArrowRight className="w-4 h-4" />
                  </a>
                </div>

                <div className="bg-gradient-to-br from-success to-[hsl(160,84%,30%)] text-[hsl(0,0%,100%)] p-4 rounded-xl text-center shadow-lg shadow-success/20">
                  <Shield className="w-7 h-7 mx-auto mb-1.5" />
                  <h3 className="text-base font-extrabold tracking-wide mb-1">8-DAY PRICE GUARANTEE</h3>
                  <p className="text-sm opacity-90">Your offer is locked in. No games. No surprises.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Benefits */}
      {step < 2 && (
        <section className="px-5 pb-20">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-3xl mx-auto">
            <motion.h2 variants={fadeUp} custom={0} className="text-2xl md:text-3xl font-extrabold text-center mb-4">
              Why Now Is the{" "}
              <span className="bg-gradient-to-r from-[hsl(210,80%,60%)] to-[hsl(250,80%,70%)] bg-clip-text text-transparent">
                Perfect Time
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-center text-[hsl(215,20%,65%)] mb-12 max-w-lg mx-auto">
              As a valued service customer, you have advantages that most sellers don't.
            </motion.p>

            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((b, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 2}
                  className="flex items-start gap-4 p-5 rounded-xl bg-[hsl(222,47%,8%)] border border-[hsl(217,33%,17%)] hover:border-[hsl(210,100%,25%)]/30 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[hsl(210,100%,25%)]/15 flex items-center justify-center text-[hsl(210,80%,60%)]">
                    {b.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold mb-1">{b.title}</h3>
                    <p className="text-sm text-[hsl(215,20%,55%)] leading-relaxed">{b.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Testimonial */}
            <motion.div variants={fadeUp} custom={9} className="mt-10 max-w-lg mx-auto text-center">
              <div className="bg-[hsl(222,47%,8%)] border border-[hsl(217,33%,17%)] rounded-2xl p-6">
                <div className="flex justify-center gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-[hsl(215,20%,75%)] italic leading-relaxed mb-4">
                  "I came in for an oil change and left with a brand-new car and a lower payment. They showed me the numbers and it just made sense. Easiest car deal I've ever done."
                </p>
                <p className="text-xs font-semibold text-[hsl(215,20%,55%)]">— Sarah M., Hartford CT</p>
              </div>
            </motion.div>

            {/* Urgency Banner */}
            <motion.div variants={fadeUp} custom={10} className="mt-8 max-w-lg mx-auto">
              <div className="bg-gradient-to-r from-[hsl(210,100%,25%)]/20 to-[hsl(250,80%,40%)]/20 border border-[hsl(210,100%,25%)]/30 rounded-xl p-5 text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-[hsl(210,80%,60%)]" />
                <h3 className="text-sm font-bold mb-1">Market Alert: Used Car Values Are Shifting</h3>
                <p className="text-xs text-[hsl(215,20%,60%)] leading-relaxed">
                  Pre-owned vehicle values are adjusting as new inventory increases. Today's offer could be higher than next month's. Lock in your price now.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </section>
      )}

      {/* Bottom CTA */}
      {step < 2 && (
        <section className="px-5 pb-16">
          <div className="max-w-md mx-auto text-center">
            <h2 className="text-xl font-bold mb-3">Ready to See Your Offer?</h2>
            <p className="text-sm text-[hsl(215,20%,65%)] mb-6">It takes less than 60 seconds. No obligation.</p>
            <Button
              onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="px-10 py-5 bg-accent hover:bg-accent/90 text-accent-foreground text-base font-bold shadow-lg shadow-accent/20 hover:-translate-y-0.5 transition-all"
            >
              Get My Free Offer
            </Button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[hsl(217,33%,17%)] py-8 px-5 text-center">
        <img src={serviceLogo} alt="Harte Auto Group" className="h-20 mx-auto mb-3 opacity-60" />
        <p className="text-xs text-[hsl(215,20%,45%)]">
          Family-owned since 1952 • 150 Weston Street, Hartford, CT 06120 • (866) 851-7390
        </p>
      </footer>
    </div>
  );
};

export default ServiceLanding;
