import { Car, FileCheck, Camera, Video, Lock, ChevronDown, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePlatform } from "@/contexts/PlatformContext";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const ICON_MAP: Record<string, React.ElementType> = {
  Car,
  FileCheck,
  Camera,
  Video,
};

interface AppSwitcherProps {
  currentApp?: string;
}

const AppSwitcher = ({ currentApp = "autocurb" }: AppSwitcherProps) => {
  const { products, activeProducts, hasProduct, subscription, bundles } = usePlatform();
  const [open, setOpen] = useState(false);

  const currentProductData = products.find((p) => p.id === currentApp);
  const CurrentIcon = currentProductData ? ICON_MAP[currentProductData.icon_name] || Car : Car;

  const currentBundle = bundles.find((b) => b.id === subscription?.bundle_id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 h-8 px-2.5 rounded-md transition-all duration-200 text-white/70 hover:text-white hover:bg-white/10 active:scale-[0.97] group"
          aria-label="Switch product"
        >
          <div className="w-5 h-5 rounded-md bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
            <CurrentIcon className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold hidden sm:inline">
            {currentProductData?.name || "Autocurb"}
          </span>
          <ChevronDown className={`w-3 h-3 text-white/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Autocurb Platform
          </p>
        </div>

        {/* Product Grid */}
        <div className="p-2 grid grid-cols-2 gap-1.5">
          {products
            .filter((p) => p.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((product) => {
              const Icon = ICON_MAP[product.icon_name] || Car;
              const isActive = hasProduct(product.id);
              const isCurrent = product.id === currentApp;

              return (
                <button
                  key={product.id}
                  onClick={() => {
                    if (isActive && !isCurrent) {
                      window.location.href = product.base_url;
                    }
                    if (isCurrent) {
                      setOpen(false);
                    }
                  }}
                  disabled={!isActive}
                  className={`
                    relative flex flex-col items-start gap-2 p-3 rounded-lg text-left transition-all duration-200
                    ${isCurrent
                      ? "bg-primary/10 border border-primary/30 shadow-sm"
                      : isActive
                        ? "hover:bg-muted/80 border border-transparent hover:border-border/50 cursor-pointer"
                        : "opacity-50 border border-transparent cursor-default"
                    }
                  `}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground shadow-md"
                          : isActive
                            ? "bg-muted text-foreground"
                            : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {!isActive && (
                      <Lock className="w-3 h-3 text-muted-foreground/60" />
                    )}
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className={`text-xs font-semibold leading-tight ${isCurrent ? "text-primary" : "text-foreground"}`}>
                      {product.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                      {product.description}
                    </p>
                  </div>

                  {!isActive && (
                    <span className="text-[9px] font-medium text-muted-foreground/70 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Upgrade to unlock
                    </span>
                  )}
                </button>
              );
            })}
        </div>

        {/* Footer — Current Plan */}
        <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Current plan:</span>
            <Badge variant="secondary" className="text-[10px] h-5 font-semibold">
              {currentBundle?.name || "No Plan"}
            </Badge>
          </div>
          {activeProducts.length < products.filter((p) => p.is_active).length && (
            <span className="text-[10px] text-primary font-semibold cursor-pointer hover:underline">
              Upgrade
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AppSwitcher;
