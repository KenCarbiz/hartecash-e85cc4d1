import harteLogo from "@/assets/harte-logo.png";

const SiteHeader = () => {
  return (
    <header className="bg-card sticky top-0 z-50 shadow-md">
      <div className="max-w-[500px] mx-auto px-5 py-3">
        <div className="flex items-center justify-center">
          <img src={harteLogo} alt="Harte Auto Group" className="h-44 md:h-52 w-auto" />
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
