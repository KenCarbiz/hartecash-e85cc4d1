/**
 * Camera support detection + graceful degradation helpers.
 *
 * Used by DocumentCameraCapture and VehicleCameraCapture so customers who
 * land on the upload flow through an in-app webview (Instagram, Facebook,
 * Gmail), an HTTP context, or a browser that doesn't expose mediaDevices
 * get a clear explanation AND a working fallback instead of a dead-end
 * "Unable to access camera" message.
 *
 * Fallback strategy: every error screen surfaces a hidden
 * <input type="file" accept="image/*" capture="environment"> that opens
 * the native OS camera via the file picker. That path works in every
 * browser, including every in-app webview, because it does not use
 * getUserMedia at all.
 */

/**
 * The reason getUserMedia failed (or would fail). Used to pick a
 * user-facing message and decide whether to offer the retry button.
 */
export type CameraBlockReason =
  | "no_mediadevices"      // window.navigator.mediaDevices is undefined
  | "insecure_context"     // not HTTPS / not localhost
  | "in_app_webview"       // Instagram / FB / Gmail / LinkedIn in-app browser
  | "permission_denied"    // user tapped Block, or iframe lacks allow=camera
  | "no_camera_found"      // device has no camera at all
  | "camera_in_use"        // another app has the camera open
  | "overconstrained"      // requested facingMode/resolution unavailable
  | "unknown";

export interface CameraBlock {
  reason: CameraBlockReason;
  /** Short one-liner for the error card. */
  title: string;
  /** Longer explanation + what to do. */
  detail: string;
  /** True if the user might succeed by tapping "Try again" (vs needing to
   *  switch browsers or grant permission manually). */
  retryable: boolean;
}

/**
 * Detect common in-app webviews by user agent. These browsers typically
 * cannot request camera permission at all — tapping Allow does nothing.
 *
 * References:
 * - Facebook / Messenger: "FBAN" or "FBAV"
 * - Instagram: "Instagram"
 * - LinkedIn: "LinkedInApp"
 * - Line: "Line/"
 * - TikTok: "BytedanceWebview" or "musical_ly"
 * - WeChat: "MicroMessenger"
 * - Pinterest: "Pinterest"
 * - Snapchat: "Snapchat"
 * - Twitter/X: "Twitter"
 */
export function detectInAppWebview(): { isWebview: boolean; appName: string | null } {
  if (typeof navigator === "undefined") return { isWebview: false, appName: null };
  const ua = navigator.userAgent || "";

  const signatures: [RegExp, string][] = [
    [/FBAN|FBAV|FB_IAB/i, "Facebook"],
    [/Instagram/i, "Instagram"],
    [/LinkedInApp/i, "LinkedIn"],
    [/Line\//i, "LINE"],
    [/BytedanceWebview|musical_ly/i, "TikTok"],
    [/MicroMessenger/i, "WeChat"],
    [/Pinterest/i, "Pinterest"],
    [/Snapchat/i, "Snapchat"],
    [/Twitter/i, "Twitter"],
    [/GSA\//i, "Google App"],
  ];

  for (const [regex, name] of signatures) {
    if (regex.test(ua)) return { isWebview: true, appName: name };
  }
  return { isWebview: false, appName: null };
}

/**
 * Quick synchronous preflight before we even call getUserMedia. Catches
 * the cases where getUserMedia would 100% fail so we can show a better
 * message (and skip the permission prompt entirely on in-app webviews).
 */
export function preflightCamera(): CameraBlock | null {
  if (typeof window === "undefined") return null;

  // Secure context is required everywhere except localhost
  if (window.isSecureContext === false) {
    return {
      reason: "insecure_context",
      title: "Secure connection required",
      detail:
        "This page needs to be loaded over HTTPS for your phone to open the camera. Copy the link and open it in a secure browser, or use the Upload Photo button instead.",
      retryable: false,
    };
  }

  // In-app webviews — detect BEFORE we call getUserMedia so the user
  // doesn't see a broken permission dialog
  const webview = detectInAppWebview();
  if (webview.isWebview) {
    return {
      reason: "in_app_webview",
      title: `${webview.appName ?? "This app"}'s built-in browser can't open the camera`,
      detail: `You're viewing this page inside ${webview.appName ?? "an app"}, which doesn't support camera access. Tap the three dots in the top corner and choose "Open in Safari" (iPhone) or "Open in Chrome" (Android) — then the camera will work. Or use the Upload Photo button below to pick a photo from your gallery.`,
      retryable: false,
    };
  }

  // mediaDevices API missing entirely (very old browsers, some WebViews)
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return {
      reason: "no_mediadevices",
      title: "Camera capture not supported",
      detail:
        "Your browser doesn't expose the camera API, but you can still upload a photo from your phone's gallery or take one with your camera app directly. Tap Upload Photo below.",
      retryable: false,
    };
  }

  return null;
}

/**
 * Translate a DOMException / Error from getUserMedia into a structured
 * CameraBlock for the UI.
 */
export function classifyCameraError(err: unknown): CameraBlock {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = (err as { message?: string } | null)?.message ?? "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return {
        reason: "permission_denied",
        title: "Camera permission denied",
        detail:
          "We asked for camera permission and it was denied. On iPhone, open Settings → Safari → Camera and set it to Allow. On Android Chrome, tap the lock icon in the address bar and enable Camera. Or use Upload Photo to pick from your gallery.",
        retryable: true,
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        reason: "no_camera_found",
        title: "No camera found",
        detail:
          "We couldn't find a camera on this device. Use Upload Photo to pick a photo from your files instead.",
        retryable: false,
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        reason: "camera_in_use",
        title: "Camera in use by another app",
        detail:
          "Another app is currently using your camera (e.g. Zoom, FaceTime). Close it and tap Try Again, or use Upload Photo below.",
        retryable: true,
      };
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return {
        reason: "overconstrained",
        title: "Camera couldn't start",
        detail:
          "Your camera doesn't support the settings we requested. Tap Try Again and we'll use a simpler configuration.",
        retryable: true,
      };
    case "SecurityError":
      return {
        reason: "insecure_context",
        title: "Camera blocked by security policy",
        detail:
          "Your browser blocked the camera because the page isn't served over HTTPS, or this page is embedded in an iframe without camera permission. Use Upload Photo below.",
        retryable: false,
      };
    case "TypeError":
      return {
        reason: "no_mediadevices",
        title: "Camera capture not supported",
        detail:
          "Your browser doesn't expose the camera API. Use Upload Photo below to take a photo with your phone's camera app or pick from your gallery.",
        retryable: false,
      };
    default:
      return {
        reason: "unknown",
        title: "Camera couldn't start",
        detail: message
          ? `${message}. Tap Try Again or use Upload Photo below.`
          : "Something went wrong opening the camera. Tap Try Again or use Upload Photo below.",
        retryable: true,
      };
  }
}

/**
 * Convenience: try getUserMedia with a primary constraint set, then
 * retry once with a looser constraint set if the first attempt throws
 * OverconstrainedError. This fixes the common case where an older
 * Android phone can't do 1920x1080 and we'd otherwise bail out.
 */
export async function requestCameraStream(
  facingMode: "environment" | "user",
): Promise<MediaStream> {
  const primary: MediaStreamConstraints = {
    video: {
      facingMode,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
  try {
    return await navigator.mediaDevices.getUserMedia(primary);
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      // Fallback: just ask for the rear camera with no resolution hint
      return await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
    }
    throw err;
  }
}
