import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * usePushSubscription — staff-side web-push enablement.
 *
 * Walks the user through:
 *   1. Checking browser support (PushManager, serviceWorker)
 *   2. Checking/requesting Notification permission
 *   3. Registering the service worker at /sw.js
 *   4. Subscribing the service worker's push manager with the platform
 *      VAPID public key
 *   5. Persisting endpoint + keys to public.push_subscriptions so the
 *      send-push edge function can target them later
 *
 * Returns a snapshot of the subscription state + enable/disable
 * actions. Consumers render a toggle based on supported / permission /
 * subscribed.
 */

type PermissionState = "default" | "granted" | "denied";

interface State {
  supported: boolean;
  permission: PermissionState;
  subscribed: boolean;
  loading: boolean;
  error: string | null;
}

// Base64URL → Uint8Array (the PushManager.subscribe applicationServerKey
// argument wants raw bytes). Standard helper for web-push.
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
};

export const usePushSubscription = () => {
  const [state, setState] = useState<State>({
    supported: false,
    permission: "default",
    subscribed: false,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (!supported) {
      setState({ supported: false, permission: "default", subscribed: false, loading: false, error: null });
      return;
    }
    const permission = (Notification.permission as PermissionState) || "default";
    let subscribed = false;
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        subscribed = !!sub;
      }
    } catch {
      /* noop — treat as unsubscribed */
    }
    setState({ supported: true, permission, subscribed, loading: false, error: null });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications aren't supported on this browser.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          permission === "denied"
            ? "You blocked notifications for this site. Unblock them in browser settings and try again."
            : "You need to allow notifications to enable this."
        );
      }

      // Register the service worker (idempotent).
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      // VAPID public key lives in a Vite env var. If missing the whole
      // feature is disabled — fail loudly so dealers don't silently
      // think push works when it doesn't.
      const vapid = (import.meta as any).env?.VITE_PUSH_VAPID_PUBLIC_KEY as string | undefined;
      if (!vapid) {
        throw new Error("Push isn't configured on this environment — tell your admin to set VITE_PUSH_VAPID_PUBLIC_KEY.");
      }

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
        }));

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Subscription returned an unexpected shape — try again.");
      }

      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp?.user;
      if (!user) throw new Error("You're not signed in.");

      // Upsert on endpoint — re-enabling on the same device replaces
      // the existing row rather than duplicating.
      const { error: upsertErr } = await (supabase as any)
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            device_label: labelForUserAgent(),
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            is_active: true,
            last_active_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "endpoint" }
        );
      if (upsertErr) throw new Error(upsertErr.message);

      setState({ supported: true, permission: "granted", subscribed: true, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Could not enable push notifications." }));
    }
  }, []);

  const disable = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await (supabase as any)
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() } as any)
          .eq("endpoint", endpoint);
      }
      setState((s) => ({ ...s, subscribed: false, loading: false }));
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Could not disable." }));
    }
  }, []);

  return { ...state, enable, disable, refresh };
};

const labelForUserAgent = (): string | null => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "This device";
};
