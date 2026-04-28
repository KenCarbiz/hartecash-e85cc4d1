/**
 * Autocurb / HarteCash dynamic embed loader.
 *
 * Install ONCE on the dealer's website:
 *
 *   <script src="https://hartecash.com/embed-loader.js"
 *           data-tenant="dealership-id-here" async></script>
 *
 * The loader fetches the latest embed configuration from our backend at
 * runtime. Every change made in the Autocurb admin (button color, copy,
 * sale banner, active assets) propagates to the live site within ~30
 * seconds — the dealer's web provider never touches the page again.
 *
 * Architecture:
 *   1. Reads data-tenant + optional data-config-url from its own script tag.
 *   2. Fetches /functions/v1/embed-config?tenant=<id> from Supabase.
 *   3. Lazy-loads /embed.js (which exposes window.HarteCash.* APIs).
 *   4. Calls the matching APIs based on the active assets in the config.
 *
 * Fail-safe: any network or parse error is logged to console, the loader
 * exits silently, and the dealer site keeps working.
 */

(function () {
  "use strict";

  // ── Locate our own script tag ──────────────────────────────────────
  // The standard pattern: pick the currently-executing script. Falls
  // back to scanning if document.currentScript isn't available (very
  // old browsers — the loader still works because we use defaults).
  var thisScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (
          scripts[i].src &&
          scripts[i].src.indexOf("embed-loader.js") !== -1
        ) {
          return scripts[i];
        }
      }
      return null;
    })();

  if (!thisScript) {
    console.warn("[Autocurb] embed-loader couldn't locate its own <script> tag");
    return;
  }

  var tenant = thisScript.getAttribute("data-tenant");
  if (!tenant) {
    console.warn("[Autocurb] embed-loader: missing data-tenant attribute");
    return;
  }

  // Where to fetch the config from. The EmbedToolkit "Install Snippet"
  // UI bakes the right URL into the snippet it generates so this works
  // out of the box without the dealer's web provider knowing anything
  // about Supabase. Falling back to a relative /api/embed-config path
  // for environments that proxy through their own domain.
  var explicitConfigUrl = thisScript.getAttribute("data-config-url");
  var configUrl = explicitConfigUrl
    ? explicitConfigUrl + (explicitConfigUrl.indexOf("?") >= 0 ? "&" : "?") +
        "tenant=" + encodeURIComponent(tenant)
    : "/api/embed-config?tenant=" + encodeURIComponent(tenant);

  // Where to load the asset-rendering library (window.HarteCash.*).
  // Defaults to the same origin this loader was served from so a single
  // install line covers both. Override with data-embed-url if you host
  // the loader on one domain and embed.js on another.
  var embedUrl =
    thisScript.getAttribute("data-embed-url") ||
    new URL("embed.js", thisScript.src).toString();

  // ── Step 1 — fetch the runtime config ──────────────────────────────
  fetch(configUrl, { method: "GET" })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("embed-config returned HTTP " + res.status);
      }
      return res.json();
    })
    .then(function (cfg) {
      if (!cfg || cfg.error) {
        throw new Error(cfg && cfg.error ? cfg.error : "Empty config");
      }
      // Step 2 — load the asset library.
      return loadScript(embedUrl).then(function () {
        return cfg;
      });
    })
    .then(function (cfg) {
      // Step 3 — bootstrap whichever assets are active.
      var H = window.HarteCash;
      if (!H) {
        console.warn("[Autocurb] embed.js loaded but window.HarteCash missing");
        return;
      }

      var common = {
        baseUrl: cfg.baseUrl,
        store: cfg.dealershipId,
        color: cfg.buttonColor,
        text: cfg.buttonText,
        ctaText: cfg.bannerCtaText,
        drawerTitle: cfg.drawerTitle,
        openMode: cfg.openMode,
        position: cfg.widgetPosition,
      };

      var assets = (cfg.activeAssets || []).reduce(function (acc, a) {
        acc[a] = true;
        return acc;
      }, {});

      // The "iframe" / "widget" / "button" assets all bootstrap via init()
      // — they live on the same floating button + drawer infrastructure.
      if (assets.iframe || assets.widget || assets.button) {
        try {
          H.init(common);
        } catch (e) {
          console.warn("[Autocurb] init failed:", e);
        }
      }

      if (assets.sticky) {
        try {
          H.sticky({
            baseUrl: cfg.baseUrl,
            store: cfg.dealershipId,
            color: cfg.buttonColor,
            text: cfg.stickyText,
            ctaText: cfg.stickyCtaText,
            position: cfg.stickyPosition,
            openMode: cfg.openMode,
          });
        } catch (e) {
          console.warn("[Autocurb] sticky failed:", e);
        }
      }

      // The VDP/SRP banner has to be opted into per-page — it requires a
      // container element on the page. We can't auto-mount it from the
      // loader without a target, so we expose a helper instead.
      window.HarteCash.bannerWith = function (containerId) {
        try {
          H.banner(
            Object.assign({}, common, {
              container: containerId,
              headline: cfg.bannerHeadline,
              text: cfg.bannerText,
              ctaText: cfg.bannerCtaText,
            })
          );
        } catch (e) {
          console.warn("[Autocurb] banner failed:", e);
        }
      };

      // Sale banner overlays (highest-attention CTA when active).
      if (cfg.saleBanner && cfg.saleBanner.active) {
        try {
          // Re-use the sticky bar with sale text — simpler than a new asset.
          H.sticky({
            baseUrl: cfg.baseUrl,
            store: cfg.dealershipId,
            color: cfg.buttonColor,
            text: cfg.saleBanner.text || "Limited-time offer",
            ctaText: cfg.saleBanner.ctaText || "Claim Now",
            position: "top",
            openMode: cfg.openMode,
          });
        } catch (e) {
          console.warn("[Autocurb] sale banner failed:", e);
        }
      }
    })
    .catch(function (err) {
      console.warn("[Autocurb] embed-loader failed:", err && err.message);
    });

  // ── Tiny script loader (no Promise polyfill needed, all modern browsers) ──
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      // Don't double-load.
      if (document.querySelector('script[src="' + src + '"]')) {
        return resolve();
      }
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      (document.head || document.body || document.documentElement).appendChild(s);
    });
  }
})();
