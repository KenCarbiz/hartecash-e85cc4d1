/* customerAvatar — shared avatar state + UI for the customer portal.

   The portal customer record has no avatar column yet, so a chosen
   avatar is persisted client-side (localStorage, keyed by the customer's
   email) and broadcast via a custom event so every avatar on screen —
   the Profile drawer and the top-right AccountMenu — updates live.

   A customer can:
     • Upload a photo (center-cropped + downscaled to a small square so
       it stays well under the localStorage quota).
     • Pick a monogram — their initials on a curated, brand-aligned
       gradient.
     • Pick a clean icon avatar (person / car / key) on a brand tint.
     • Remove it and fall back to their initials.

   Precedence when rendering: stored avatar → caller-supplied
   `fallbackImageUrl` (e.g. an employee's profile photo) → initials. */

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Upload, Trash2, Check, User, Car, CarFront, KeyRound,
  type LucideIcon,
} from "lucide-react";

/* ───────────────────────── Presets ───────────────────────── */

/** Curated gradients pulled from the portal's own palette (violet
 *  primary, navy, plus professional accents) for monogram avatars. */
export type ColorTheme = { id: string; from: string; to: string };

export const COLOR_THEMES: ColorTheme[] = [
  { id: "violet",  from: "#6D28D9", to: "#4338CA" },
  { id: "indigo",  from: "#4F46E5", to: "#6366F1" },
  { id: "navy",    from: "#06194A", to: "#23408E" },
  { id: "sky",     from: "#0EA5E9", to: "#2563EB" },
  { id: "teal",    from: "#0D9488", to: "#14B8A6" },
  { id: "emerald", from: "#16A34A", to: "#0F7A3E" },
  { id: "amber",   from: "#F59E0B", to: "#EA580C" },
  { id: "rose",    from: "#F43F5E", to: "#BE123C" },
  { id: "slate",   from: "#475569", to: "#1E293B" },
];

const themeById = (id: string) => COLOR_THEMES.find((t) => t.id === id);

/** Clean line icons relevant to selling a vehicle, shown on the portal's
 *  signature brand tint (#EEF0FF with #6D28D9). */
export type AvatarIcon = { id: string; Icon: LucideIcon; label: string };

export const AVATAR_ICONS: AvatarIcon[] = [
  { id: "user",     Icon: User,     label: "Person" },
  { id: "car",      Icon: Car,      label: "Car" },
  { id: "carfront", Icon: CarFront, label: "Car (front)" },
  { id: "key",      Icon: KeyRound, label: "Key" },
];

const iconById = (id: string) => AVATAR_ICONS.find((i) => i.id === id);

/** A stored avatar value is one of:
 *    "mono:<themeId>"  — initials on a COLOR_THEMES gradient
 *    "icon:<iconId>"   — an AVATAR_ICONS glyph on brand tint
 *    "data:image…"     — an uploaded (downscaled) photo
 *    "http(s)://…"     — an external image URL */
const isMono = (v?: string | null): boolean => !!v && v.startsWith("mono:");
const isIcon = (v?: string | null): boolean => !!v && v.startsWith("icon:");
const isImage = (v?: string | null): boolean =>
  !!v && (v.startsWith("data:") || v.startsWith("http"));

/* ───────────────────────── Store ───────────────────────── */

const KEY_PREFIX = "moto.customerAvatar:";
const EVENT = "moto:customer-avatar-changed";

const keyFor = (id: string) => KEY_PREFIX + (id || "default");

export function getCustomerAvatar(id: string): string | null {
  try {
    return localStorage.getItem(keyFor(id));
  } catch {
    return null;
  }
}

export function setCustomerAvatar(id: string, value: string | null) {
  try {
    if (value) localStorage.setItem(keyFor(id), value);
    else localStorage.removeItem(keyFor(id));
  } catch {
    /* quota / private mode — non-fatal, avatar just won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id } }));
}

/** Subscribe to the current customer's avatar, updating on any change
 *  (this tab via the custom event, or another tab via `storage`). */
export function useCustomerAvatar(id: string): string | null {
  const subscribe = useCallback(
    (cb: () => void) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    [],
  );
  const getSnapshot = useCallback(() => getCustomerAvatar(id), [id]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* ───────────────────────── Upload helper ───────────────────────── */

/** Read an image file, center-crop to a square and downscale so the
 *  resulting data URL is small enough to comfortably store. */
function fileToSquareDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* ───────────────────────── Display ───────────────────────── */

export const CustomerAvatar = ({
  value,
  initials,
  fallbackImageUrl,
  className = "",
  alt = "Avatar",
}: {
  value?: string | null;
  initials: string;
  /** Used when no avatar has been chosen — e.g. an employee profile photo. */
  fallbackImageUrl?: string | null;
  className?: string;
  alt?: string;
}) => {
  if (isImage(value)) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img src={value!} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
      </div>
    );
  }
  if (isMono(value)) {
    const t = themeById(value!.slice("mono:".length));
    if (t) {
      return (
        <div
          className={`relative overflow-hidden ${className}`}
          style={{ backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
        >
          <span className="text-white">{initials}</span>
        </div>
      );
    }
  }
  if (isIcon(value)) {
    const i = iconById(value!.slice("icon:".length));
    if (i) {
      return (
        <div className={className}>
          <i.Icon className="w-1/2 h-1/2" strokeWidth={2.25} />
        </div>
      );
    }
  }
  if (isImage(fallbackImageUrl)) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img src={fallbackImageUrl!} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
      </div>
    );
  }
  return <div className={className}>{initials}</div>;
};

/* ───────────────────────── Picker ───────────────────────── */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Inline avatar editor used inside the Profile drawer. Controlled —
 *  reports the chosen value (or null to clear) via `onChange`. */
export const AvatarPicker = ({
  value,
  initials,
  onChange,
  onClose,
}: {
  value: string | null;
  initials: string;
  onChange: (next: string | null) => void;
  onClose?: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Image is too large — max 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      onChange(dataUrl);
      toast.success("Photo ready — save changes to keep it.");
    } catch {
      toast.error("Sorry, that image couldn't be processed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E6EAF0] bg-[#F7F8FB] p-3.5">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onSelectFile} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#5B21B6] transition disabled:opacity-60"
        >
          <Upload className="w-3.5 h-3.5" />
          {busy ? "Processing…" : "Upload photo"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-[12px] font-semibold text-[#53627A] hover:text-[#06194A]"
          >
            Done
          </button>
        )}
      </div>

      <div className="mt-3.5 text-[11px] uppercase tracking-wide font-semibold text-[#8893A8]">
        Monogram
      </div>
      <div className="mt-2 grid grid-cols-9 gap-2">
        {COLOR_THEMES.map((t) => {
          const selected = value === `mono:${t.id}`;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(`mono:${t.id}`)}
              aria-label={`Monogram ${t.id}`}
              aria-pressed={selected}
              className={`relative aspect-square rounded-full grid place-items-center text-[12px] font-bold text-white transition ${
                selected ? "ring-2 ring-[#6D28D9] ring-offset-2 ring-offset-[#F7F8FB]" : "hover:scale-105"
              }`}
              style={{ backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
            >
              {initials || "A"}
              {selected && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#6D28D9] grid place-items-center ring-2 ring-white">
                  <Check className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3.5 text-[11px] uppercase tracking-wide font-semibold text-[#8893A8]">
        Icon
      </div>
      <div className="mt-2 flex gap-2">
        {AVATAR_ICONS.map(({ id, Icon, label }) => {
          const selected = value === `icon:${id}`;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(`icon:${id}`)}
              aria-label={label}
              aria-pressed={selected}
              className={`relative w-9 h-9 rounded-full grid place-items-center bg-[#EEF0FF] text-[#6D28D9] transition ${
                selected ? "ring-2 ring-[#6D28D9] ring-offset-2 ring-offset-[#F7F8FB]" : "hover:bg-[#E0E7FF]"
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={2.25} />
              {selected && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#6D28D9] grid place-items-center ring-2 ring-white">
                  <Check className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
