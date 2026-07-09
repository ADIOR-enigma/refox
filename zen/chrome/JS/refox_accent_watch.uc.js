// chrome/JS/refox-accent-watch.uc.js

(function () {
  const PATH = "/home/adior/.cache/wal/colors.json";

  let last = 0;
  let cache = {};

  function applyTheme(c) {
    const root = document.documentElement;

    // Avoid redundant reapply
    if (JSON.stringify(cache) === JSON.stringify(c)) return;
    cache = c;

    // Core mapping
    root.style.setProperty("--zen-accent-primary", c.color3, "important");
    root.style.setProperty("--zen-accent-secondary", c.color5, "important");
    root.style.setProperty("--zen-background", c.color0, "important");
    root.style.setProperty("--zen-text", c.color15, "important");
    root.style.setProperty("--zen-text-focus", "#ffffff", "important");

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

  // 🔥 Wait for Zen UI (critical)
  function waitForZen() {
    const interval = setInterval(() => {
      if (document.querySelector("zen-workspace")) {
        clearInterval(interval);

        // Multi-pass apply (handles lazy UI)
        readTheme(true);
        setTimeout(() => readTheme(true), 300);
        setTimeout(() => readTheme(true), 1000);
      }
    }, 100);
  }

  waitForZen();

  // 🔁 Slow polling for wal changes (efficient)
  setInterval(() => readTheme(), 800);

})();