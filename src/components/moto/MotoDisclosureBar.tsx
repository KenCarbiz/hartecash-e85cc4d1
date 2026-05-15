import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Bottom disclosure bar for the standalone site. Hidden when iframed
 * so the dealer's host page provides its own legal footer.
 */
const MotoDisclosureBar = () => {
  const { config } = useSiteConfig();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-zinc-200 bg-white py-6">
      <div className="mx-auto max-w-screen-sm px-4 text-center text-xs leading-relaxed text-zinc-500">
        <p>
          Values shown are estimates from third-party providers (Kelley Blue Book / Black Book)
          based on the information you supplied. Final offer is subject to inspection.
        </p>
        <p className="mt-2">
          © {year} {config.dealership_name || "Dealer"} · Images provided by EVOX IMAGES®
        </p>
        <p className="mt-2 space-x-3">
          <a href="/privacy" className="hover:text-zinc-700">Privacy Policy</a>
          <span>·</span>
          <a href="/terms" className="hover:text-zinc-700">Terms</a>
        </p>
      </div>
    </footer>
  );
};

export default MotoDisclosureBar;
