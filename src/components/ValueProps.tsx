import { DollarSign, Clock, Truck, ShieldCheck } from "lucide-react";

const ValueProps = () => {
  const items = [
    {
      icon: <DollarSign className="w-8 h-8 text-accent" />,
      title: "Top Dollar Guaranteed",
      desc: "We use real-time market data to ensure you get the best price.",
    },
    {
      icon: <Clock className="w-8 h-8 text-accent" />,
      title: "Offer in 2 Minutes",
      desc: "No waiting around — get your cash offer almost instantly.",
    },
    {
      icon: <Truck className="w-8 h-8 text-accent" />,
      title: "Free Pickup",
      desc: "We come to your home or office. Zero hassle on your end.",
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-accent" />,
      title: "Trusted Dealership",
      desc: "Family-owned since 1952. Thousands of happy customers.",
    },
  ];

  return (
    <section className="py-16 px-5 bg-background">
      <h2 className="text-2xl md:text-[28px] font-extrabold text-center mb-12 text-foreground">
        Why Sell to Harte?
      </h2>
      <div className="grid gap-4 max-w-[500px] mx-auto">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-4 p-5 bg-card rounded-xl shadow-sm"
          >
            <div className="flex-shrink-0 mt-1">{item.icon}</div>
            <div>
              <h4 className="text-base font-bold mb-1 text-card-foreground">
                {item.title}
              </h4>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ValueProps;
