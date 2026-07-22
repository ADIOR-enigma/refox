// chrome/JS/refox-accent-watch.uc.js

(function () {
  const PATH = "/home/adior/.cache/wal/colors.json";
  const STYLE_ID = "wal-theme";

  let last = 0;
  let cache = {};

  const CSS = `
:root {
  --zen-primary-color: var(--zen-accent-primary) !important;
}

#navigator-toolbox {
  background: var(--zen-background) !important;
}

#zen-appcontent-wrapper {
  background: var(--zen-background) !important;
}

#tabbrowser-tabs .tabbrowser-tab[selected] .tab-background {
  background: var(--zen-primary-color) !important;
}
`;

  function ensureStyleElement() {
    let style = document.getElementById(STYLE_ID);

    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }

    if (style.textContent !== CSS) {
      style.textContent = CSS;
    }
  }

  function applyTheme(c) {
    const root = document.documentElement;

    // Avoid redundant reapply
    if (
      cache.color0 === c.color0 &&
      cache.color3 === c.color3 &&
      cache.color5 === c.color5 &&
      cache.color15 === c.color15
    ) {
      return;
    }
    cache = { ...c };

    // Core mapping
    root.style.setProperty("--zen-accent-primary", c.color3, "important");
    root.style.setProperty("--zen-accent-secondary", c.color5, "important");
    root.style.setProperty("--zen-background", c.color0, "important");
    root.style.setProperty("--zen-text", c.color15, "important");
    root.style.setProperty("--zen-text-focus", "#ffffff", "important");
    root.style.setProperty("--zen-primary-color", c.color3, "important");

    ensureStyleElement();
  }

  async function readTheme(force = false) {
    try {
      const stat = await IOUtils.stat(PATH);

      if (!force && stat.lastModified === last) return;
      last = stat.lastModified;

      const data = JSON.parse(await IOUtils.readUTF8(PATH));
      if (!data.colors) return;

      applyTheme(data.colors);
    } catch {}
  }

  // Wait for Zen UI
  function waitForZen() {
    const interval = setInterval(() => {
      if (
        document.querySelector("zen-workspace") ||
        document.querySelector("#zen-appcontent-wrapper")
      ) {
        clearInterval(interval);

        // Multi-pass apply (handles lazy UI)
        readTheme(true);
        setTimeout(() => readTheme(true), 300);
        setTimeout(() => readTheme(true), 1000);
      }
    }, 100);
  }

  waitForZen();

  setInterval(() => readTheme(), 800);
})();
