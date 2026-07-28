// chrome/JS/refox-accent-watch.uc.js

(function () {
  const PATH = "/home/adior/.cache/wal/colors.json";
  let last = 0;
  let cache = {};

  const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  let registeredUri = null;

  function applyTheme(c) {
    const bg = c.background || c.color0;
    const prm = c.primary || c.color3;
    const sec = c.secondary || c.color5;
    const txt = c.text || c.color15;

    // Avoid redundant reapply
    if (
      cache.background === bg &&
      cache.primary === prm &&
      cache.secondary === sec &&
      cache.text === txt
    ) {
      return;
    }
    cache = { background: bg, primary: prm, secondary: sec, text: txt };

    const css = `
      :root {
        --refox-accent-primary: ${prm} !important;
        --refox-accent-secondary: ${sec} !important;
        --refox-background: ${bg} !important;
        --refox-text: ${txt} !important;
        --refox-text-focus: #ffffff !important;
      }
    `;

    const uri = Services.io.newURI("data:text/css;charset=utf-8," + encodeURIComponent(css), null, null);

    if (registeredUri) {
      if (sss.sheetRegistered(registeredUri, sss.USER_SHEET)) {
        sss.unregisterSheet(registeredUri, sss.USER_SHEET);
      }
    }

    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    registeredUri = uri;
  }

  async function readTheme(force = false) {
    try {
      const stat = await IOUtils.stat(PATH);

      if (!force && stat.lastModified === last) return;
      last = stat.lastModified;

      const data = JSON.parse(await IOUtils.readUTF8(PATH));
      if (!data.colors) return;

      applyTheme(data.colors);
    } catch { }
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
