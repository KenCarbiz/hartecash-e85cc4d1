/**
 * HarteCash Dealer Integration Widget v2
 *
 * Three integration modes:
 *   1. Floating Button  — persistent CTA on every page (existing behavior, enhanced)
 *   2. Slide-Out Drawer — opens iframe in an overlay panel without leaving the page
 *   3. VDP/SRP Banner   — inline banner for inventory pages with customizable CTA
 *
 * Usage: See admin panel → Storefront → Website Embed
 */
(function () {
  "use strict";

  // ── Shared helpers ──────────────────────────────────────────────

  function buildIframeUrl(baseUrl, opts) {
    var params = [];
    params.push("mode=" + (opts.mode || "trade"));
    if (opts.store) params.push("store=" + opts.store);
    if (opts.ref) params.push("ref=" + opts.ref);
    if (opts.rep) params.push("rep=" + opts.rep);
    return baseUrl + "/trade-in?" + params.join("&");
  }

  function injectStyles(css) {
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Slide-out Drawer ────────────────────────────────────────────

  var drawer = null;
  var drawerIframe = null;
  var overlay = null;

  function createDrawer(cfg) {
    if (drawer) return;

    var iframeSrc = buildIframeUrl(cfg.baseUrl || "", cfg);

    injectStyles([
      ".hc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998;opacity:0;transition:opacity .3s ease;pointer-events:none}",
      ".hc-overlay.hc-open{opacity:1;pointer-events:auto}",
      ".hc-drawer{position:fixed;top:0;right:0;bottom:0;width:min(520px,92vw);z-index:99999;background:#fff;box-shadow:-8px 0 40px rgba(0,0,0,.2);transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;border-radius:16px 0 0 16px}",
      ".hc-drawer.hc-open{transform:translateX(0)}",
      ".hc-drawer-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e5e7eb;flex-shrink:0;background:#fafafa;border-radius:16px 0 0 0}",
      ".hc-drawer-title{font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:700;color:#1a1a1a;margin:0}",
      ".hc-drawer-close{background:none;border:none;cursor:pointer;padding:6px;border-radius:6px;color:#666;font-size:20px;line-height:1;transition:background .15s}",
      ".hc-drawer-close:hover{background:#f0f0f0;color:#333}",
      ".hc-drawer iframe{flex:1;border:none;width:100%}",
    ].join("\n"));

    // Overlay
    overlay = document.createElement("div");
    overlay.className = "hc-overlay";
    overlay.addEventListener("click", closeDrawer);
    document.body.appendChild(overlay);

    // Drawer panel
    drawer = document.createElement("div");
    drawer.className = "hc-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "Trade-In Value");

    // Header
    var header = document.createElement("div");
    header.className = "hc-drawer-header";

    var title = document.createElement("p");
    title.className = "hc-drawer-title";
    title.textContent = cfg.drawerTitle || "Get Your Trade-In Value";
    header.appendChild(title);

    var closeBtn = document.createElement("button");
    closeBtn.className = "hc-drawer-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&#x2715;";
    closeBtn.addEventListener("click", closeDrawer);
    header.appendChild(closeBtn);

    drawer.appendChild(header);

    // Iframe
    drawerIframe = document.createElement("iframe");
    drawerIframe.src = iframeSrc;
    drawerIframe.title = "Trade-In Your Vehicle";
    drawerIframe.allow = "camera";
    drawerIframe.loading = "lazy";
    drawer.appendChild(drawerIframe);

    document.body.appendChild(drawer);

    // Listen for Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  }

  function openDrawer(cfg) {
    if (!drawer) createDrawer(cfg);
    // Small delay for CSS transition
    requestAnimationFrame(function () {
      overlay.classList.add("hc-open");
      drawer.classList.add("hc-open");
      document.body.style.overflow = "hidden";
    });
  }

  function closeDrawer() {
    if (!drawer) return;
    overlay.classList.remove("hc-open");
    drawer.classList.remove("hc-open");
    document.body.style.overflow = "";
  }

  // ── Floating Button ─────────────────────────────────────────────

  function createFloatingButton(cfg) {
    var btn = document.createElement("button");
    btn.textContent = cfg.text || "Get Your Trade-In Value";
    btn.setAttribute("aria-label", btn.textContent);

    var isRight = (cfg.position || "bottom-right") === "bottom-right";
    var color = cfg.color || "#1a365d";

    btn.style.cssText = [
      "position:fixed",
      "z-index:99997",
      "bottom:24px",
      isRight ? "right:24px" : "left:24px",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "padding:14px 24px",
      "background:" + color,
      "color:#fff",
      "font-family:system-ui,-apple-system,sans-serif",
      "font-size:15px",
      "font-weight:700",
      "border-radius:50px",
      "border:none",
      "text-decoration:none",
      "cursor:pointer",
      "box-shadow:0 4px 20px rgba(0,0,0,.25)",
      "transition:transform .2s,box-shadow .2s",
      "white-space:nowrap",
    ].join(";");

    // Car icon SVG
    var icon = document.createElement("span");
    icon.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
    icon.style.cssText = "display:flex;align-items:center";
    btn.prepend(icon);

    // Promo badge
    if (cfg.promoText) {
      var badge = document.createElement("span");
      badge.textContent = cfg.promoText;
      badge.style.cssText = [
        "background:#f59e0b",
        "color:#000",
        "font-size:11px",
        "font-weight:800",
        "padding:2px 8px",
        "border-radius:20px",
        "margin-left:4px",
        "white-space:nowrap",
      ].join(";");
      btn.appendChild(badge);
    }

    btn.onmouseover = function () {
      btn.style.transform = "translateY(-2px)";
      btn.style.boxShadow = "0 6px 28px rgba(0,0,0,.3)";
    };
    btn.onmouseout = function () {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 4px 20px rgba(0,0,0,.25)";
    };

    // Click behavior: slide-out drawer (default) or new tab
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (cfg.openMode === "new-tab") {
        window.open(cfg.url || buildIframeUrl(cfg.baseUrl || "", cfg), "_blank", "noopener");
      } else {
        openDrawer(cfg);
      }
    });

    document.body.appendChild(btn);
  }

  // ── VDP / SRP Inline Banner ─────────────────────────────────────

  function createVdpBanner(cfg) {
    var container = document.getElementById(cfg.targetId || "hartecash-banner");
    if (!container) return;

    var color = cfg.color || "#1a365d";
    var text = cfg.text || "What's your current car worth? Get your trade-in value instantly.";
    var ctaText = cfg.ctaText || "Get Trade Value";

    injectStyles([
      ".hc-banner{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;gap:16px;padding:16px 20px;background:linear-gradient(135deg," + color + "," + color + "dd);color:#fff;border-radius:12px;margin:12px 0;flex-wrap:wrap}",
      ".hc-banner-icon{flex-shrink:0;opacity:.9}",
      ".hc-banner-text{flex:1;min-width:200px}",
      ".hc-banner-text strong{display:block;font-size:15px;font-weight:700;margin-bottom:2px}",
      ".hc-banner-text span{font-size:13px;opacity:.9}",
      ".hc-banner-cta{display:inline-flex;align-items:center;gap:6px;padding:10px 22px;background:#fff;color:" + color + ";font-size:14px;font-weight:700;border-radius:8px;border:none;cursor:pointer;white-space:nowrap;transition:transform .15s,box-shadow .15s;box-shadow:0 2px 8px rgba(0,0,0,.15)}",
      ".hc-banner-cta:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,.2)}",
    ].join("\n"));

    var banner = document.createElement("div");
    banner.className = "hc-banner";

    // Icon
    var iconWrap = document.createElement("div");
    iconWrap.className = "hc-banner-icon";
    iconWrap.innerHTML =
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
    banner.appendChild(iconWrap);

    // Text
    var textWrap = document.createElement("div");
    textWrap.className = "hc-banner-text";
    textWrap.innerHTML = "<strong>" + (cfg.headline || "Have a Trade-In?") + "</strong><span>" + text + "</span>";
    banner.appendChild(textWrap);

    // CTA button
    var cta = document.createElement("button");
    cta.className = "hc-banner-cta";
    cta.textContent = ctaText;
    cta.addEventListener("click", function () {
      if (cfg.openMode === "new-tab") {
        window.open(cfg.url || buildIframeUrl(cfg.baseUrl || "", cfg), "_blank", "noopener");
      } else {
        openDrawer(cfg);
      }
    });
    banner.appendChild(cta);

    container.appendChild(banner);
  }

  // ── VDP / SRP Sticky Ghost Link ──────────────────────────────────
  // A thin, semi-transparent bar that follows the customer as they scroll.
  // Appears after a short scroll delay so it doesn't feel intrusive.

  function createStickyLink(cfg) {
    var color = cfg.color || "#1a365d";
    var text = cfg.text || "Get your trade-in value";
    var position = cfg.position || "bottom"; // "bottom" or "top"

    injectStyles([
      ".hc-sticky{position:fixed;" + position + ":0;left:0;right:0;z-index:99996;font-family:system-ui,-apple-system,sans-serif;transform:translateY(" + (position === "bottom" ? "100%" : "-100%") + ");transition:transform .4s cubic-bezier(.4,0,.2,1);pointer-events:none}",
      ".hc-sticky.hc-visible{transform:translateY(0);pointer-events:auto}",
      ".hc-sticky-inner{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 16px;background:" + color + "f0;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;cursor:pointer;transition:background .2s}",
      ".hc-sticky-inner:hover{background:" + color + "}",
      ".hc-sticky-text{font-size:14px;font-weight:600;letter-spacing:.01em}",
      ".hc-sticky-cta{background:rgba(255,255,255,.2);color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.3);white-space:nowrap;transition:background .15s}",
      ".hc-sticky-inner:hover .hc-sticky-cta{background:rgba(255,255,255,.3)}",
      ".hc-sticky-close{position:absolute;" + (position === "bottom" ? "top" : "bottom") + ":-28px;right:12px;background:rgba(0,0,0,.5);color:#fff;border:none;border-radius:50%;width:24px;height:24px;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}",
      ".hc-sticky:hover .hc-sticky-close{opacity:1}",
    ].join("\n"));

    var wrapper = document.createElement("div");
    wrapper.className = "hc-sticky";

    var inner = document.createElement("div");
    inner.className = "hc-sticky-inner";

    // Car icon (small)
    var icon = document.createElement("span");
    icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
    icon.style.cssText = "display:flex;align-items:center;opacity:.9";
    inner.appendChild(icon);

    var textEl = document.createElement("span");
    textEl.className = "hc-sticky-text";
    textEl.textContent = text;
    inner.appendChild(textEl);

    if (cfg.ctaText) {
      var ctaEl = document.createElement("span");
      ctaEl.className = "hc-sticky-cta";
      ctaEl.textContent = cfg.ctaText;
      inner.appendChild(ctaEl);
    }

    inner.addEventListener("click", function () {
      if (cfg.openMode === "new-tab") {
        window.open(cfg.url || buildIframeUrl(cfg.baseUrl || "", cfg), "_blank", "noopener");
      } else {
        openDrawer(cfg);
      }
    });

    wrapper.appendChild(inner);

    // Close button
    var closeBtn = document.createElement("button");
    closeBtn.className = "hc-sticky-close";
    closeBtn.innerHTML = "&#x2715;";
    closeBtn.setAttribute("aria-label", "Dismiss");
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      wrapper.classList.remove("hc-visible");
      try { sessionStorage.setItem("hc-sticky-dismissed", "1"); } catch (ex) {}
    });
    wrapper.appendChild(closeBtn);

    document.body.appendChild(wrapper);

    // Show after scroll threshold (200px) unless dismissed this session
    var dismissed = false;
    try { dismissed = sessionStorage.getItem("hc-sticky-dismissed") === "1"; } catch (ex) {}

    if (!dismissed) {
      var scrollDelay = cfg.showAfterScroll || 200;
      var shown = false;
      window.addEventListener("scroll", function () {
        if (shown || dismissed) return;
        if (window.scrollY > scrollDelay) {
          wrapper.classList.add("hc-visible");
          shown = true;
        }
      });
      // Also show after 5 seconds regardless of scroll
      setTimeout(function () {
        if (!shown && !dismissed) {
          wrapper.classList.add("hc-visible");
          shown = true;
        }
      }, cfg.showAfterMs || 5000);
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  window.HarteCash = {
    /** Floating button + optional slide-out drawer */
    init: function (cfg) {
      cfg = cfg || {};
      createFloatingButton(cfg);
    },

    /** VDP/SRP inline banner */
    banner: function (cfg) {
      cfg = cfg || {};
      createVdpBanner(cfg);
    },

    /** VDP/SRP sticky ghost link — follows customer while scrolling */
    sticky: function (cfg) {
      cfg = cfg || {};
      createStickyLink(cfg);
    },

    /** Programmatically open the drawer */
    open: function (cfg) {
      openDrawer(cfg || window._hcConfig || {});
    },

    /** Programmatically close the drawer */
    close: closeDrawer,
  };

  // Backwards compatibility with v1
  window.AutoCurbWidget = {
    init: function (cfg) {
      cfg = cfg || {};
      // v1 opened in new tab by default
      if (!cfg.openMode) cfg.openMode = "new-tab";
      createFloatingButton(cfg);
    },
  };
})();
