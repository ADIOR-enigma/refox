import { IExtensionMessage, IExtensionTheme } from "@definitions";

import { EXTENSION_MESSAGES } from "@config/general";

const STYLE_ID = "refox-theme-variables";
const refoxWindow = window as Window & {
  refoxWebsiteThemeLoaded?: boolean;
};

function getStyleElement() {
  let element = document.getElementById(STYLE_ID) as HTMLStyleElement;

  if (!element) {
    element = document.createElement("style");
    element.id = STYLE_ID;
    document.documentElement.appendChild(element);
  }

  return element;
}

function setTheme(css: IExtensionTheme) {
  if (!css) {
    resetTheme();
    return;
  }

  getStyleElement().textContent = css;
}

function resetTheme() {
  document.getElementById(STYLE_ID)?.remove();
}

function onMessage({ action, data }: IExtensionMessage) {
  switch (action) {
    case EXTENSION_MESSAGES.WEBSITE_THEME_SET:
      setTheme(data);
      break;
    case EXTENSION_MESSAGES.WEBSITE_THEME_RESET:
      resetTheme();
      break;
    default:
      break;
  }
}

// Always (re-)register the message listener so that when the background
// injects this script into an already-loaded tab (e.g. when the user
// toggles "Expose CSS variables" on), the tab can immediately receive
// WEBSITE_THEME_SET without requiring a page reload.
// The guard only prevents sending WEBSITE_THEME_GET twice on a fresh load
// where the registered content-script and executeScript both fire.
if (refoxWindow.refoxWebsiteThemeLoaded) {
  browser.runtime.onMessage.removeListener(onMessage);
}

browser.runtime.onMessage.addListener(onMessage);

if (!refoxWindow.refoxWebsiteThemeLoaded) {
  refoxWindow.refoxWebsiteThemeLoaded = true;
  browser.runtime
    .sendMessage({ action: EXTENSION_MESSAGES.WEBSITE_THEME_GET })
    .catch(() => {});
}
