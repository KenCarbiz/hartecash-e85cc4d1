/* Shared mock data + small helpers used by every portal page.
   Keeps the dashboard preview self-contained so we can ship UI
   without wiring the real submission/offer pipeline yet. */

export const PORTAL_MOCK = {
  customer: { name: "Alex Morgan", initials: "AM", dealer: "Liberty Automotive", email: "alex.morgan@example.com", phone: "(555) 214-9087" },
  vehicle: {
    year: 2021, make: "Toyota", model: "RAV4", trim: "XLE",
    miles: "26,540", engine: "2.5L", body: "SUV",
    drivetrain: "AWD", exterior: "Silver Sky Metallic", interior: "Black SofTex",
    vin: "2T3P1RFVXMW123456",
    ownership: "Owned outright", payoff: 0,
  },
  range: { low: 19250, high: 21450 },
  firmOffer: 20150,
  offerExpires: "May 17, 2025",
  marketDemand: "High" as "High" | "Medium" | "Low",
  responseTime: "2.4 hrs",
  lastUpdate: "2 min ago",
  dealerMessage:
    "Thanks! Your vehicle details look great. We're excited to make you a firm offer.",
  docs: [
    { name: "Registration",       status: "Approved" as const, date: "May 12" },
    { name: "Title",              status: "Approved" as const, date: "May 12" },
    { name: "Driver's License",   status: "Under Review" as const, date: "May 13" },
    { name: "Odometer Photo",     status: "Approved" as const, date: "May 12" },
    { name: "Payoff Statement",   status: "Needed" as const,   date: "" },
    { name: "Insurance Card",     status: "Needed" as const,   date: "" },
  ],
  activity: [
    { id: 1, type: "submission", title: "Vehicle submitted",      time: "May 11 • 9:14 AM", desc: "You submitted your 2021 Toyota RAV4 XLE." },
    { id: 2, type: "offer",      title: "Offer generated",        time: "May 11 • 9:18 AM", desc: "Initial range $19,250 – $21,450." },
    { id: 3, type: "messages",   title: "Dealer viewed vehicle",  time: "May 11 • 10:02 AM", desc: "Liberty Automotive opened your file." },
    { id: 4, type: "documents",  title: "Documents uploaded",     time: "May 12 • 7:48 AM", desc: "Registration, Title, and Odometer photo." },
    { id: 5, type: "messages",   title: "Message received",       time: "May 12 • 11:04 AM", desc: "“Excited to make you a firm offer.”" },
    { id: 6, type: "offer",      title: "Firm offer issued",      time: "May 13 • 2:36 PM", desc: "Liberty Automotive offered $20,150." },
    { id: 7, type: "pickup",     title: "Pickup not scheduled",   time: "Pending", desc: "Schedule pickup after accepting your offer." },
    { id: 8, type: "payments",   title: "Payment pending",        time: "Pending", desc: "Payout released after pickup is confirmed." },
  ],
  conversations: [
    { id: "liberty", name: "Liberty Automotive", role: "Acquisition Manager", initials: "LA", unread: 2, last: "Thanks! We're excited to make you a firm offer.", time: "2m" },
    { id: "support", name: "Support Team",       role: "MOTO(acquire)",        initials: "ST", unread: 0, last: "Anything else we can help with?",                time: "1h" },
    { id: "pickup",  name: "Pickup Coordinator", role: "Transit Logistics",    initials: "PC", unread: 1, last: "Please confirm a pickup window.",               time: "3h" },
  ],
  payment: {
    method: "ACH Direct Deposit • Chase •••• 4127",
    status: "Pending" as const,
    offer: 20150,
    payoff: 0,
    fees: 0,
    netPayout: 20150,
  },
};

export const fmt = (n: number) => `$${n.toLocaleString()}`;
