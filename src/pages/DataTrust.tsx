import { useEffect } from "react";

// /data — the standalone "data trust" one-pager dealership staff pull up.
// The page itself is a self-contained static document at public/data.html.
// Lovable hosts this app as an SPA and ignores vercel.json, so the clean
// /data URL can't rely on a host rewrite — it needs a real React route.
// We render the static file in a full-viewport iframe so the address stays
// hartecash.com/data while serving the untouched standalone document
// (its own fonts, layout, and print styles intact).
export default function DataTrust() {
  useEffect(() => {
    document.title = "HarteCash — Your Data. Your Customers. Your Dealership.";
  }, []);

  return (
    <iframe
      src="/data.html"
      title="HarteCash — Your Data. Your Customers. Your Dealership."
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
      }}
    />
  );
}
