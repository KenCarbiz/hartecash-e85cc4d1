import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/hooks/usePushSubscription";

/**
 * PushNotificationToggle — one-click enable/disable of PWA push for
 * the current staff member on this device.
 *
 * Drops into the admin header or staff profile. Handles every
 * permission edge case:
 *   - Unsupported browser (iOS Safari pre-install) → button disabled
 *     with a hint
 *   - Permission = denied → button surfaces a "blocked — unblock in
 *     settings" message
 *   - Missing VAPID config → button surfaces a config-error message
 *   - Enabled → shows a disable button
 */

const PushNotificationToggle = ({ compact = false }: { compact?: boolean }) => {
  const { supported, permission, subscribed, loading, error, enable, disable } = usePushSubscription();

  if (!supported) {
    if (compact) return null;
    return (
      <p className="text-[11px] text-muted-foreground">
        Push notifications aren't supported in this browser. On iPhone, install the site to your Home Screen first.
      </p>
    );
  }

  if (permission === "denied") {
    if (compact) return null;
    return (
      <p className="text-[11px] text-destructive">
        Notifications are blocked for this site. Unblock them in your browser's site settings to enable.
      </p>
    );
  }

  return (
    <div className={compact ? "inline-flex items-center gap-2" : "space-y-1"}>
      {subscribed ? (
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={loading}
          onClick={disable}
          className={compact ? "h-7 text-[11px]" : ""}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <BellOff className="w-3.5 h-3.5 mr-1.5" />}
          {loading ? "…" : compact ? "Turn off push" : "Turn off push notifications"}
        </Button>
      ) : (
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={loading}
          onClick={enable}
          className={compact ? "h-7 text-[11px]" : ""}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Bell className="w-3.5 h-3.5 mr-1.5" />}
          {loading ? "…" : compact ? "Enable push" : "Enable push notifications on this device"}
        </Button>
      )}
      {!compact && !error && !subscribed && (
        <p className="text-[10px] text-muted-foreground">
          Get instant pings for escalations and "customer arrived" events — even when Autocurb isn't open.
        </p>
      )}
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </div>
  );
};

export default PushNotificationToggle;
