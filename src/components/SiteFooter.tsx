import { Link } from "react-router-dom";

const SiteFooter = () => {
  return (
    <footer className="bg-[hsl(220,13%,18%)] text-primary-foreground py-10 lg:py-14 px-5">
      <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-3 lg:gap-8 text-center lg:text-left">
        <div>
          <h3 className="text-xl font-bold mb-4 opacity-90">HARTE AUTO GROUP</h3>
          <p className="text-sm opacity-60 mb-2">
            Proudly serving Connecticut since 1952
          </p>
          <p className="text-sm opacity-60">
            © {new Date().getFullYear()} Harte Auto Group. All rights reserved.
          </p>
        </div>
        <div className="mt-6 lg:mt-0">
          <h4 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Locations</h4>
          <p className="text-sm opacity-60 leading-relaxed">
            Hartford, CT<br />
            Wallingford, CT<br />
            Meriden, CT<br />
            West Haven, CT<br />
            Old Saybrook, CT
          </p>
        </div>
        <div className="mt-6 lg:mt-0">
          <h4 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Quick Links</h4>
          <div className="flex flex-col gap-2">
            <Link to="/my-submission" className="text-sm opacity-60 hover:opacity-90 transition-opacity">View My Offer</Link>
            <Link to="/schedule" className="text-sm opacity-60 hover:opacity-90 transition-opacity">Schedule a Visit</Link>
            <Link to="/admin/login" className="text-xs opacity-40 hover:opacity-70 transition-opacity mt-2">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
