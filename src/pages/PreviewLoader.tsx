import { useState } from "react";
import RunningCarLoader from "@/components/landing/RunningCarLoader";

/**
 * /preview/loader — diagnostic preview of the RunningCarLoader.
 *
 * Lets the dealer verify exactly which version of the loader is
 * currently deployed without going through the whole landing flow.
 * Renders the loader at all three sizes side-by-side so you can
 * compare proportions, pick a custom color, and confirm the
 * line-art version (vs the prior solid silhouette) is live.
 */
const PreviewLoader = () => {
  const [color, setColor] = useState("#5B6B8A");

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400 mb-2">
            Loader preview
          </p>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            Hartecash Classic
          </h1>
          <p className="text-sm text-zinc-500">
            The official Hartecash loading animation — line-art hatchback,
            spinning wheels, dashed road. Three sizes; pick any color.
          </p>
        </header>

        <div className="mb-10 flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Color
          </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 rounded-lg border border-zinc-200 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 px-3 rounded-lg border border-zinc-200 font-mono text-sm w-32"
          />
          <button
            type="button"
            onClick={() => setColor("#5B6B8A")}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900"
          >
            Reset to default
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(["sm", "md", "lg"] as const).map((s) => (
            <div
              key={s}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 flex flex-col items-center"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 mb-4">
                size = {s}
              </div>
              <RunningCarLoader color={color} size={s} />
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-zinc-200 bg-zinc-50 p-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 mb-4 text-center">
            Customer-facing context (what shows during BB lookup)
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="mb-6" style={{ color }}>
              <RunningCarLoader color={color} size="lg" />
            </div>
            <p className="text-lg font-medium tracking-tight text-zinc-900">
              Looking up your{" "}
              <span className="font-mono font-bold">ABC1234</span>…
            </p>
            <p className="text-sm text-zinc-500 mt-2 max-w-sm">
              Pulling your vehicle details from the CT registry.
            </p>
          </div>
        </div>

        <p className="mt-8 text-xs text-zinc-400">
          If the version visible here doesn't match the public landing's
          lookup screen, the public landing is on a stale Vercel deploy
          — wait a minute and hard-refresh.
        </p>
      </div>
    </div>
  );
};

export default PreviewLoader;
