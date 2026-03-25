import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import harteLogo from "@/assets/harte-logo-white.png";

const Sitemap = () => {
  const sections = [
    {
      title: "Main Pages",
      links: [
        { label: "Sell Us Landing", to: "/" },
        { label: "About Us", to: "/about" },
        { label: "Service Landing", to: "/service" },
        { label: "Schedule a Visit", to: "/schedule" },
      ],
    },
    {
      title: "Customer",
      links: [
        { label: "View My Offer", to: "/my-submission" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Platform Updates", to: "/updates" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", to: "/privacy" },
        { label: "Terms of Service", to: "/terms" },
        { label: "Offer Disclosure", to: "/disclosure" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="bg-primary text-primary-foreground px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={harteLogo} alt="Harte Auto Group" className="h-20 w-auto" />
          <h1 className="font-bold text-lg">Sitemap</h1>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto px-5 py-10 md:py-14 w-full">
        <h1 className="text-3xl font-extrabold mb-8 text-foreground">Sitemap</h1>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                {section.title}
              </h2>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-foreground hover:text-accent transition-colors underline underline-offset-2"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 px-5 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Harte Auto Group. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Sitemap;
