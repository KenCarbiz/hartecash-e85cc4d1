/**
 * AutoCurb Floating Trade-In Widget
 * Usage: See admin panel → Storefront → Embed Toolkit
 */
(function () {
  "use strict";

  window.AutoCurbWidget = {
    init: function (cfg) {
      cfg = cfg || {};
      var url = cfg.url || "/";
      var text = cfg.text || "Get Your Trade-In Value";
      var promoText = cfg.promoText || ""; // e.g. "+ $500 Bonus!"
      var color = cfg.color || "#1a365d";
      var position = cfg.position || "bottom-right";

      // Create floating button
      var btn = document.createElement("a");
      btn.href = url;
      btn.target = "_blank";
      btn.rel = "noopener";
      btn.textContent = text;
      btn.setAttribute("aria-label", text);

      // Styles
      var isRight = position === "bottom-right";
      btn.style.cssText = [
        "position:fixed",
        "z-index:99999",
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
        "text-decoration:none",
        "cursor:pointer",
        "box-shadow:0 4px 20px rgba(0,0,0,.25)",
        "transition:transform .2s,box-shadow .2s",
        "white-space:nowrap",
      ].join(";");

      // Add car icon SVG
      var icon = document.createElement("span");
      icon.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
      icon.style.cssText = "display:flex;align-items:center";

      btn.prepend(icon);

      // Add promo badge if configured
      if (promoText) {
        var badge = document.createElement("span");
        badge.textContent = promoText;
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

      document.body.appendChild(btn);
    },
  };
})();
