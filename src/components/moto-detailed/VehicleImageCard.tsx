import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inferBodyStyle, type VehicleBodyStyle } from "./inferBodyStyle";

/**
 * VehicleImageCard — single source of truth for vehicle imagery in
 * the moto-detailed journey. Image hierarchy:
 *
 *   1. Real photo passed in via `imageUrl` (BB / VIN provider).
 *   2. Auto-fetch from the `generate-vehicle-image` edge function
 *      using year/make/model (Black Book → Wikipedia → AI fallback,
 *      with a localStorage cache). Used when no `imageUrl` is given.
 *   3. Premium silhouette fallback inferred from body style
 *      (truck / suv / coupe / sedan).
 *
 * Never a flat gray "Vehicle photo" block. The same y/m/m → URL is
 * cached in localStorage so every step in the journey reuses the
 * same image without re-fetching.
 */
interface Props {
  imageUrl?: string | null;
  year?: string | null;
  make?: string | null;
  model?: string | null;
  uvc?: string | null;
  /** When false, skip the network fetch and only use silhouette fallback. */
  autoFetch?: boolean;
  bodyStyle?: VehicleBodyStyle;
  /** Tailwind aspect ratio class. Defaults to 16/10 for the right rail. */
  aspectClassName?: string;
  className?: string;
  alt?: string;
}

const cacheKey = (year?: string | null, make?: string | null, model?: string | null) =>
  `journey-vehicle-img-v1-${year ?? ""}-${make ?? ""}-${model ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, "_");

const NULL_SENTINEL = "__none__";

const VehicleImageCard = ({
  imageUrl,
  year,
  make,
  model,
  uvc,
  autoFetch = true,
  bodyStyle,
  aspectClassName = "aspect-[16/10]",
  className = "",
  alt,
}: Props) => {
  const [errored, setErrored] = useState(false);
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const fetchedFor = useRef<string>("");
  const resolvedBody = bodyStyle ?? inferBodyStyle(make, model);

  // Lazy-fetch a real photo when none was passed in. Cached across
  // every journey step so the same vehicle image renders consistently.
  useEffect(() => {
    if (imageUrl || !autoFetch || !year || !make || !model) return;
    const key = cacheKey(year, make, model);
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;

    try {
      const cached = localStorage.getItem(key);
      if (cached === NULL_SENTINEL) return;
      if (cached) {
        setFetchedUrl(cached);
        return;
      }
    } catch {
      /* localStorage unavailable */
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("generate-vehicle-image", {
          body: {
            year,
            make,
            model,
            color: "white",
            uvc: uvc ?? undefined,
            angle: "three_quarter",
          },
        });
        if (cancelled) return;
        const url = data?.image_url as string | undefined;
        if (url) {
          try { localStorage.setItem(key, url); } catch { /* quota */ }
          setFetchedUrl(url);
        } else {
          try { localStorage.setItem(key, NULL_SENTINEL); } catch { /* quota */ }
        }
      } catch {
        /* silhouette fallback handles it */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, autoFetch, year, make, model, uvc]);

  const displayUrl = imageUrl || fetchedUrl;
  const showFallback = !displayUrl || errored;

  return (
    <div
      className={`relative w-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-[hsl(262_83%_58%/0.08)] ${aspectClassName} ${className}`}
    >
      {!showFallback ? (
        <img
          src={displayUrl!}
          alt={alt ?? (`${make ?? ""} ${model ?? ""}`.trim() || "Vehicle")}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <Fallback bodyStyle={resolvedBody} />
      )}
    </div>
  );
};

const Fallback = ({ bodyStyle }: { bodyStyle: VehicleBodyStyle }) => (
  <>
    <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-slate-50 via-white to-[hsl(215_40%_96%)]" />
    <div
      className="absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage:
          "radial-gradient(hsl(215 20% 65% / 0.35) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    />
    {/* Soft glow under silhouette */}
    <div className="absolute left-1/2 top-1/2 h-32 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(262_83%_58%/0.18)] blur-2xl" />
    <div className="relative flex h-full flex-col items-center justify-center">
      <Silhouette body={bodyStyle} />
      <p className="mt-2 text-[11px] font-medium text-slate-400">
        Vehicle image pending
      </p>
    </div>
    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white to-transparent" />
  </>
);

/* ── Hand-rolled silhouettes ────────────────────────────────────── */
const STROKE = "hsl(262 60% 45%)";
const FILL = "hsl(262 83% 58% / 0.12)";

const Silhouette = ({ body }: { body: VehicleBodyStyle }) => {
  const common = {
    width: 96,
    height: 56,
    viewBox: "0 0 120 70",
    fill: "none" as const,
    xmlns: "http://www.w3.org/2000/svg",
    className: "drop-shadow-[0_4px_8px_rgba(124,58,237,0.25)]",
  };
  switch (body) {
    case "truck":
      return (
        <svg {...common}>
          {/* Cab + bed silhouette */}
          <path
            d="M8 50 L8 42 Q8 38 12 38 L40 38 L50 22 Q52 18 58 18 L78 18 Q82 18 84 22 L92 38 L108 38 Q112 38 112 42 L112 50 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Bed line */}
          <line x1="78" y1="38" x2="78" y2="50" stroke={STROKE} strokeWidth="1.5" />
          {/* Windows */}
          <path d="M54 22 L58 22 L62 36 L54 36 Z" fill="white" stroke={STROKE} strokeWidth="1" />
          <path d="M64 22 L76 22 L82 36 L64 36 Z" fill="white" stroke={STROKE} strokeWidth="1" />
          <Wheels />
        </svg>
      );
    case "suv":
      return (
        <svg {...common}>
          <path
            d="M10 50 L10 40 Q10 36 14 36 L26 36 L36 20 Q38 16 44 16 L84 16 Q90 16 92 20 L102 36 L106 36 Q110 36 110 40 L110 50 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M40 20 L62 20 L62 34 L34 34 Z" fill="white" stroke={STROKE} strokeWidth="1" />
          <path d="M64 20 L84 20 L94 34 L64 34 Z" fill="white" stroke={STROKE} strokeWidth="1" />
          <Wheels />
        </svg>
      );
    case "coupe":
      return (
        <svg {...common}>
          <path
            d="M8 50 L8 42 Q8 38 14 36 L28 32 L42 22 Q46 18 54 18 L74 18 Q82 18 86 22 L100 32 L114 36 Q116 38 116 42 L116 50 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M44 24 L74 24 L92 34 L34 34 Z" fill="white" stroke={STROKE} strokeWidth="1" />
          <Wheels />
        </svg>
      );
    case "sedan":
    default:
      return (
        <svg {...common}>
          <path
            d="M8 50 L8 42 Q8 38 14 38 L24 38 L36 24 Q40 20 48 20 L74 20 Q82 20 86 24 L98 38 L108 38 Q112 38 112 42 L112 50 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M40 26 L60 26 L62 36 L34 36 Z" fill="white" stroke={STROKE} strokeWidth="1" />
          <path d="M62 26 L80 26 L90 36 L62 36 Z" fill="white" stroke={STROKE} strokeWidth="1" />
          <Wheels />
        </svg>
      );
  }
};

const Wheels = () => (
  <>
    <circle cx="30" cy="52" r="7" fill="white" stroke={STROKE} strokeWidth="2" />
    <circle cx="30" cy="52" r="2.5" fill={STROKE} />
    <circle cx="90" cy="52" r="7" fill="white" stroke={STROKE} strokeWidth="2" />
    <circle cx="90" cy="52" r="2.5" fill={STROKE} />
  </>
);

export default VehicleImageCard;
