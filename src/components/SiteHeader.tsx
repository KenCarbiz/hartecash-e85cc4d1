import harteLogo from "@/assets/harte-logo.png";
import { Link } from "react-router-dom";

const SiteHeader = () => {
  return (
    <header className="bg-card sticky top-0 z-50 shadow-md">
      <div className="max-w-[500px] mx-auto px-5 py-3">
        <div className="flex items-center justify-between">
          <img src={harteLogo} alt="Harte Auto Group" className="h-24 md:h-28 w-auto" />
          <Link 
            to="/my-submission" 
            className="text-sm font-medium text-accent hover:text-accent/80 transition-colors"
          >
            My Submission
          </Link>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
