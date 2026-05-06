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
    var path = "/trade-in";

    if (opts.ppt) {
      path = "/push-pull-tow";
      if (opts.amount) params.push("amount=" + opts.amount);
    } else {
      params.push("mode=" + (opts.mode || "trade"));
    }

    if (opts.store) params.push("store=" + opts.store);
    if (opts.ref) params.push("ref=" + opts.ref);
    if (opts.rep) params.push("rep=" + opts.rep);
    return baseUrl + path + "?" + params.join("&");
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

  // ── Inventory-Aware Embed (v3) ──────────────────────────────────
  // Mounts the dealer's full landing template inside an iframe (no
  // chrome, just the flow). Detects the inventory vehicle the
  // customer is browsing, persists their resume token + offer in
  // localStorage so the floating button copy adapts to their state,
  // and forwards trade value (with state tax credit) into the
  // iframe so the inventory-aware banner can frame the embed as
  // "apply your trade toward this car."

  function lsKey(dealerId) {
    return "hartecash_embed_state__" + dealerId;
  }

  function readState(dealerId) {
    try {
      var raw = localStorage.getItem(lsKey(dealerId));
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeState(dealerId, patch) {
    try {
      var current = readState(dealerId);
      var next = Object.assign({}, current, patch, { updated_at: Date.now() });
      // Stamp offer_made_at the first time we see status:offer_made
      // so time-decay escalation has a stable anchor independent of
      // updated_at (which moves every postMessage).
      if (patch.status === "offer_made" && !current.offer_made_at) {
        next.offer_made_at = Date.now();
      }
      // Reset the anchor if the customer accepts — avoids escalating
      // an already-converted lead.
      if (patch.status === "deal_accepted") {
        next.offer_made_at = null;
      }
      localStorage.setItem(lsKey(dealerId), JSON.stringify(next));
      return next;
    } catch (e) {
      return patch;
    }
  }

  // Days since the customer first received an offer. Returns 0
  // when no offer or no anchor.
  function daysSinceOffer(state) {
    if (!state || !state.offer_made_at) return 0;
    return Math.floor((Date.now() - state.offer_made_at) / 86400000);
  }

  // Escalation tier for time-decay re-engagement. The pill only
  // reshapes around stale offers — first-time visitors and
  // accepted deals stay on their normal CTA.
  //   0   → ambient (normal pill)
  //   1   → pulse + soft toast (Day 2–4)
  //   2   → ghost overlay nudge once per session (Day 5–6)
  //   3   → auto-open the iframe overlay (Day 7+)
  function escalationTier(state) {
    if (!state || state.status !== "offer_made") return 0;
    var d = daysSinceOffer(state);
    if (d >= 7) return 3;
    if (d >= 5) return 2;
    if (d >= 2) return 1;
    return 0;
  }

  // Pulls a vehicle off the inventory page. Schema.org Vehicle
  // JSON-LD wins (most modern dealer DMS exports include it), then
  // Open Graph product meta as a fallback.
  function detectInventoryVehicle() {
    try {
      var ldNodes = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < ldNodes.length; i++) {
        var raw = ldNodes[i].textContent;
        if (!raw) continue;
        var parsed;
        try { parsed = JSON.parse(raw); } catch (e) { continue; }
        var items = Array.isArray(parsed) ? parsed : [parsed];
        for (var j = 0; j < items.length; j++) {
          var item = items[j];
          if (!item || !item["@type"]) continue;
          var type = Array.isArray(item["@type"]) ? item["@type"].join(",") : item["@type"];
          if (!/Vehicle|Car|Product/i.test(type)) continue;
          var label = [item.modelDate || item.vehicleModelDate, item.brand && (item.brand.name || item.brand), item.model || item.name]
            .filter(Boolean)
            .join(" ")
            .trim();
          if (!label && item.name) label = item.name;
          var price = 0;
          var offers = item.offers;
          if (offers) {
            var off = Array.isArray(offers) ? offers[0] : offers;
            price = Number(off && (off.price || off.priceSpecification && off.priceSpecification.price)) || 0;
          }
          if (label) return { label: label, msrp: price };
        }
      }
    } catch (e) { /* ignore JSON-LD parse errors */ }

    var ogTitle = document.querySelector('meta[property="og:title"]');
    var ogPrice = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]');
    if (ogTitle) {
      return {
        label: ogTitle.getAttribute("content") || "",
        msrp: Number(ogPrice && ogPrice.getAttribute("content")) || 0,
      };
    }
    return { label: "", msrp: 0 };
  }

  function buildEmbedUrl(cfg, vehicle) {
    var host = (cfg.host || "https://hartecash.com").replace(/\/$/, "");
    var dealerId = cfg.dealerId;
    var state = readState(dealerId);
    var params = ["mode=" + (cfg.displayMode === "overlay" ? "overlay" : "inline")];

    if (cfg.template) params.push("template=" + encodeURIComponent(cfg.template));
    if (cfg.store) params.push("store=" + encodeURIComponent(cfg.store));
    if (cfg.ref) params.push("ref=" + encodeURIComponent(cfg.ref));
    if (cfg.rep) params.push("rep=" + encodeURIComponent(cfg.rep));
    if (state.token) params.push("t=" + encodeURIComponent(state.token));
    if (state.offer) params.push("offer=" + encodeURIComponent(state.offer));
    if (state.zip) params.push("zip=" + encodeURIComponent(state.zip));
    if (vehicle && vehicle.label) params.push("vehicle_label=" + encodeURIComponent(vehicle.label));
    if (vehicle && vehicle.msrp) params.push("vehicle_msrp=" + encodeURIComponent(vehicle.msrp));

    return host + "/embed/" + encodeURIComponent(dealerId) + "?" + params.join("&");
  }

  // State-aware floating-button copy. Re-engagement is the whole
  // point — a customer who already has an offer should see "Apply
  // your $X toward this vehicle" on a VDP and "Increase your trade
  // offer" everywhere else (homepage, SRP, content pages). The
  // returning-customer recognition comes from localStorage state
  // persisted across pageloads on the same dealer domain.
  //
  // Returns: { primary, secondary, intent }
  //   intent === "apply"  — open the embed flow with vehicle context
  //   intent === "boost"  — deep-link to /boost-offer/:token
  //   intent === "view"   — open the customer portal / accepted deal
  //   intent === "resume" — resume the in-progress submission
  //   intent === "start"  — first-time visitor, start the flow
  function getFloatingCopy(state, vehicle) {
    var status = state && state.status;
    var offer = state && Number(state.offer) || 0;
    var hasVehicle = !!(vehicle && vehicle.label);
    var vehicleShort = hasVehicle ? vehicle.label.replace(/^\s*\d{4}\s+/, "") : "";

    // Returning customer — accepted deal. Surface the deal portal.
    if (status === "deal_accepted") {
      return {
        primary: "View your accepted offer",
        secondary: hasVehicle ? "Apply toward this " + vehicleShort : "Schedule pickup",
        intent: "view",
      };
    }

    // Returning customer — has an offer. Two flavors:
    //   on a VDP → frame as "apply your $X toward THIS car"
    //   off VDP → frame as "increase your $X offer" (boost flow)
    if (offer > 0) {
      if (hasVehicle) {
        return {
          primary: "Apply your $" + offer.toLocaleString() + " toward this " + vehicleShort,
          secondary: "Tap to see your effective price",
          intent: "apply",
        };
      }
      return {
        primary: "Increase your $" + offer.toLocaleString() + " trade offer",
        secondary: "Add photos to unlock more $",
        intent: "boost",
      };
    }

    // Returning customer mid-flow — resume.
    if (status === "in_progress") {
      return {
        primary: "Resume your trade-in",
        secondary: "Pick up where you left off",
        intent: "resume",
      };
    }

    // First-time visitor.
    return {
      primary: "Get your trade-in value",
      secondary: hasVehicle ? "Apply toward this " + vehicleShort : "Free, instant offer",
      intent: "start",
    };
  }

  // Full-bleed overlay iframe (separate from the slim drawer above
  // — the drawer is for the legacy /trade-in endpoint; this is for
  // the dealer's full landing template).
  var overlayFrame = null;
  var overlayBackdrop = null;

  function openInventoryOverlay(cfg, vehicle) {
    if (overlayFrame) return;
    injectStyles([
      ".hc-embed-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;opacity:0;transition:opacity .3s ease}",
      ".hc-embed-backdrop.hc-open{opacity:1}",
      ".hc-embed-overlay{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);width:min(960px,94vw);height:min(720px,90vh);z-index:99999;background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden;opacity:0;transition:opacity .3s ease,transform .3s ease}",
      ".hc-embed-overlay.hc-open{opacity:1;transform:translate(-50%,-50%) scale(1)}",
      ".hc-embed-overlay iframe{width:100%;height:100%;border:0;display:block}",
    ].join("\n"));

    overlayBackdrop = document.createElement("div");
    overlayBackdrop.className = "hc-embed-backdrop";
    overlayBackdrop.addEventListener("click", closeInventoryOverlay);
    document.body.appendChild(overlayBackdrop);

    overlayFrame = document.createElement("div");
    overlayFrame.className = "hc-embed-overlay";
    overlayFrame.setAttribute("role", "dialog");
    overlayFrame.setAttribute("aria-label", "Trade-In");

    var iframe = document.createElement("iframe");
    iframe.src = buildEmbedUrl(Object.assign({}, cfg, { displayMode: "overlay" }), vehicle);
    iframe.allow = "camera; clipboard-read; clipboard-write";
    iframe.loading = "lazy";
    overlayFrame.appendChild(iframe);

    document.body.appendChild(overlayFrame);
    document.body.style.overflow = "hidden";

    requestAnimationFrame(function () {
      overlayBackdrop.classList.add("hc-open");
      overlayFrame.classList.add("hc-open");
    });
  }

  // Open an arbitrary HarteCash URL in the same overlay shell —
  // used for boost/view/resume intents that deep-link past the
  // /embed/:dealershipId flow into a token-scoped page.
  function openDirectOverlay(url) {
    if (overlayFrame) return;
    injectStyles([
      ".hc-embed-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;opacity:0;transition:opacity .3s ease}",
      ".hc-embed-backdrop.hc-open{opacity:1}",
      ".hc-embed-overlay{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);width:min(960px,94vw);height:min(720px,90vh);z-index:99999;background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden;opacity:0;transition:opacity .3s ease,transform .3s ease}",
      ".hc-embed-overlay.hc-open{opacity:1;transform:translate(-50%,-50%) scale(1)}",
      ".hc-embed-overlay iframe{width:100%;height:100%;border:0;display:block}",
    ].join("\n"));

    overlayBackdrop = document.createElement("div");
    overlayBackdrop.className = "hc-embed-backdrop";
    overlayBackdrop.addEventListener("click", closeInventoryOverlay);
    document.body.appendChild(overlayBackdrop);

    overlayFrame = document.createElement("div");
    overlayFrame.className = "hc-embed-overlay";
    overlayFrame.setAttribute("role", "dialog");

    var iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.allow = "camera; clipboard-read; clipboard-write";
    iframe.loading = "lazy";
    overlayFrame.appendChild(iframe);

    document.body.appendChild(overlayFrame);
    document.body.style.overflow = "hidden";

    requestAnimationFrame(function () {
      overlayBackdrop.classList.add("hc-open");
      overlayFrame.classList.add("hc-open");
    });
  }

  function closeInventoryOverlay() {
    if (!overlayFrame) return;
    overlayBackdrop.classList.remove("hc-open");
    overlayFrame.classList.remove("hc-open");
    document.body.style.overflow = "";
    setTimeout(function () {
      if (overlayFrame && overlayFrame.parentNode) overlayFrame.parentNode.removeChild(overlayFrame);
      if (overlayBackdrop && overlayBackdrop.parentNode) overlayBackdrop.parentNode.removeChild(overlayBackdrop);
      overlayFrame = null;
      overlayBackdrop = null;
    }, 300);
  }

  function createInventoryEmbed(cfg) {
    if (!cfg.dealerId) {
      // Soft-fail: invalid config shouldn't break the dealer site.
      return;
    }

    var vehicle = detectInventoryVehicle();
    var state = readState(cfg.dealerId);
    var displayMode = cfg.displayMode || "floating"; // "floating" | "inline"

    // Resize listener — applies to inline mode where we need to
    // grow the iframe with content.
    var inlineFrame = null;

    window.addEventListener("message", function (e) {
      var d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "hartecash-resize" && inlineFrame && d.height) {
        inlineFrame.style.height = d.height + "px";
      } else if (d.type === "hartecash-close") {
        closeInventoryOverlay();
      } else if (d.type === "hartecash-state-change") {
        writeState(cfg.dealerId, {
          token: d.token || state.token,
          status: d.status,
          offer: d.offer,
        });
        // Refresh button copy in place if floating button exists
        if (cfg._refreshFloating) cfg._refreshFloating();
      }
    });

    if (displayMode === "inline") {
      var target = typeof cfg.target === "string" ? document.querySelector(cfg.target) : cfg.target;
      if (!target) return;
      inlineFrame = document.createElement("iframe");
      inlineFrame.src = buildEmbedUrl(Object.assign({}, cfg, { displayMode: "inline" }), vehicle);
      inlineFrame.allow = "camera; clipboard-read; clipboard-write";
      inlineFrame.loading = "lazy";
      inlineFrame.style.cssText = "width:100%;border:0;display:block;height:600px;transition:height .25s ease";
      target.appendChild(inlineFrame);
      return;
    }

    // Floating mode — state-aware pill button.
    var copy = getFloatingCopy(state, vehicle);
    var color = cfg.color || "#1a365d";

    // Time-decay escalation styles. Pulse keyframes ride on the
    // pill once we cross Day 2; an auto-open kicks in at Day 7 so
    // a long-dormant offer surfaces front-and-center on the next
    // visit. Per-session guard so we don't badger the customer on
    // every page nav.
    injectStyles([
      "@keyframes hc-pulse{0%,100%{box-shadow:0 8px 28px rgba(0,0,0,.25)}50%{box-shadow:0 8px 28px rgba(0,0,0,.25),0 0 0 8px rgba(16,185,129,.18)}}",
      ".hc-pulse{animation:hc-pulse 2.4s ease-in-out infinite}",
      ".hc-toast{position:fixed;z-index:99996;bottom:96px;right:24px;max-width:320px;background:#0f172a;color:#fff;padding:14px 18px;border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.35);font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.4;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease}",
      ".hc-toast.hc-show{opacity:1;transform:translateY(0)}",
      ".hc-toast strong{display:block;font-size:14px;font-weight:700;margin-bottom:2px}",
      ".hc-toast button{position:absolute;top:6px;right:8px;background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:14px;line-height:1;padding:4px}",
    ].join("\n"));

    var btn = document.createElement("button");
    btn.setAttribute("aria-label", copy.primary);
    btn.style.cssText = [
      "position:fixed",
      "z-index:99997",
      "bottom:24px",
      (cfg.position === "bottom-left" ? "left:24px" : "right:24px"),
      "display:flex",
      "flex-direction:column",
      "align-items:flex-start",
      "gap:1px",
      "padding:12px 22px",
      "background:" + color,
      "color:#fff",
      "font-family:system-ui,-apple-system,sans-serif",
      "border-radius:14px",
      "border:none",
      "cursor:pointer",
      "box-shadow:0 8px 28px rgba(0,0,0,.25)",
      "transition:transform .2s,box-shadow .2s",
      "white-space:nowrap",
      "text-align:left",
    ].join(";");

    function renderButton() {
      var s = readState(cfg.dealerId);
      var v = detectInventoryVehicle();
      var c = getFloatingCopy(s, v);
      var tier = escalationTier(s);
      btn.dataset.intent = c.intent;
      btn.dataset.tier = String(tier);
      // Pulse from Day 2 onwards. Tiers 1+ all pulse; tier 3 also
      // auto-opens (handled separately below).
      if (tier >= 1) btn.classList.add("hc-pulse");
      else btn.classList.remove("hc-pulse");
      btn.innerHTML =
        '<span style="font-size:14px;font-weight:700;letter-spacing:-.01em">' + c.primary + "</span>" +
        '<span style="font-size:11px;font-weight:500;opacity:.85">' + c.secondary + "</span>";
    }
    cfg._refreshFloating = renderButton;
    renderButton();

    // Time-decay escalation runner. Fires once per page load.
    //   tier 2 → soft toast nudge (once per session)
    //   tier 3 → auto-open the overlay after a 1.5s delay so it
    //            doesn't fight first paint
    function runEscalation() {
      var s = readState(cfg.dealerId);
      var tier = escalationTier(s);
      if (tier < 2) return;
      var sessionFlag = "hc-escalated-" + cfg.dealerId;
      try {
        if (sessionStorage.getItem(sessionFlag) === "1") return;
        sessionStorage.setItem(sessionFlag, "1");
      } catch (e) { /* private mode — fall through, behaves like fresh session */ }

      if (tier >= 3) {
        // Day 7+ — surface the offer overlay automatically. We
        // honor the boost intent (off-VDP, has offer) so dormant
        // customers land on the photo accelerator instead of the
        // generic flow.
        setTimeout(function () {
          var v = detectInventoryVehicle();
          var c = getFloatingCopy(s, v);
          var host = (cfg.host || "https://hartecash.com").replace(/\/$/, "");
          if (c.intent === "boost" && s.token) {
            openDirectOverlay(host + "/boost-offer/" + encodeURIComponent(s.token));
          } else {
            openInventoryOverlay(cfg, v);
          }
        }, 1500);
        return;
      }

      // Tier 2 — soft toast above the pill. Auto-dismiss after 8s
      // or on click (which opens the overlay).
      var days = daysSinceOffer(s);
      var toast = document.createElement("div");
      toast.className = "hc-toast";
      toast.innerHTML =
        '<button aria-label="Dismiss">&times;</button>' +
        "<strong>Your $" + Number(s.offer || 0).toLocaleString() + " offer is still good</strong>" +
        "It's been " + days + " days — tap to apply it toward a vehicle or boost it with photos.";
      toast.querySelector("button").addEventListener("click", function (ev) {
        ev.stopPropagation();
        toast.classList.remove("hc-show");
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
      });
      toast.addEventListener("click", function () {
        btn.click();
      });
      document.body.appendChild(toast);
      requestAnimationFrame(function () { toast.classList.add("hc-show"); });
      setTimeout(function () {
        toast.classList.remove("hc-show");
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
      }, 8000);
    }

    btn.onmouseover = function () {
      btn.style.transform = "translateY(-2px)";
      btn.style.boxShadow = "0 12px 36px rgba(0,0,0,.3)";
    };
    btn.onmouseout = function () {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 8px 28px rgba(0,0,0,.25)";
    };
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var s = readState(cfg.dealerId);
      var v = detectInventoryVehicle();
      var c = getFloatingCopy(s, v);
      var host = (cfg.host || "https://hartecash.com").replace(/\/$/, "");

      // Boost intent — off-VDP returning customer wants to bump
      // their offer. Deep-link to /boost-offer/:token in the
      // overlay iframe instead of the lookup flow.
      if (c.intent === "boost" && s.token) {
        openDirectOverlay(host + "/boost-offer/" + encodeURIComponent(s.token));
        return;
      }
      // View intent — accepted deal. Deep-link to /deal/:token.
      if (c.intent === "view" && s.token) {
        openDirectOverlay(host + "/deal/" + encodeURIComponent(s.token));
        return;
      }
      // Resume intent — submission in progress. Drop them into
      // their portal (which dispatches by status).
      if (c.intent === "resume" && s.token) {
        openDirectOverlay(host + "/my-submission/" + encodeURIComponent(s.token));
        return;
      }
      // Default — open the embed flow with vehicle context
      // (apply / start intents).
      openInventoryOverlay(cfg, v);
    });

    document.body.appendChild(btn);
    runEscalation();
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

    /**
     * v3 inventory-aware embed — mounts the dealer's full landing
     * template inside an iframe and frames it as "apply your trade
     * toward this car" when the loader detects a vehicle on the
     * inventory detail page.
     *
     * cfg:
     *   dealerId    (required) — dealership UUID
     *   host        — base URL (default https://hartecash.com)
     *   displayMode — "floating" (default) or "inline"
     *   target      — selector / element (inline mode only)
     *   color       — pill background (default #1a365d)
     *   position    — "bottom-right" (default) or "bottom-left"
     *   template    — override dealer's chosen template for this embed
     *   store, ref, rep — pre-assignment / tracking codes
     */
    inventory: function (cfg) {
      createInventoryEmbed(cfg || {});
    },
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
