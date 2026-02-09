const SiteFooter = () => {
  return (
    <footer className="bg-[hsl(220,13%,18%)] text-primary-foreground py-10 px-5 text-center">
      <h3 className="text-xl font-bold mb-6 opacity-90">HARTE AUTO GROUP</h3>
      <p className="text-sm opacity-60 mb-2">
        Proudly serving Connecticut since 1952
      </p>
      <p className="text-sm opacity-60 mb-2">
        © {new Date().getFullYear()} Harte Auto Group. All rights reserved.
      </p>
      <p className="text-sm opacity-60">
        Hartford, CT | West Hartford, CT | Manchester, CT
      </p>
    </footer>
  );
};

export default SiteFooter;
