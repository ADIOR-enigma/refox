import {
  IPalette,
  IPywalData,
  IPywalColors,
  IColorscheme,
  IBrowserTheme,
  IThemeTemplate,
  IOptionSetData,
  IExtensionTheme,
  IPaletteTemplate,
  IExtensionMessage,
  INativeAppError,
  ThemeModes,
} from "@definitions";

import {
  EXTENSION_PAGES,
  EXTENSION_OPTIONS,
  EXTENSION_COMMANDS,
  EXTENSION_MESSAGES,
  MIN_REQUIRED_DAEMON_VERSION,
} from "@config/general";

import {
  DEFAULT_THEME_DARK,
  DEFAULT_THEME_LIGHT,
} from "@config/default-themes";

import Messenger from "@communication/messenger";
import NativeMessenger from "@communication/native-messenger";

import State from "./state";
import AutoMode from "./auto-mode";
import Generators from "./generators";
import { resetBrowserActionIcon, setThemedBrowserActionIcon } from "./icon";
import ExtensionPage from "./extension-page";

export default class Extension {
  private state: State;
  private autoMode: AutoMode;
  private stateLoadPromise: Promise<void>;

  private settingsPage: ExtensionPage;
  private updatePage: ExtensionPage;
  private nativeErrorPage: ExtensionPage;

  private nativeMessenger: NativeMessenger;
  private websiteThemeTabIds: Set<number>;
  private websiteContentScript: browser.contentScripts.RegisteredContentScript;

  constructor() {
    this.state = new State();
    this.stateLoadPromise = null;
    this.websiteThemeTabIds = new Set();
    this.websiteContentScript = null;
    this.autoMode = new AutoMode(this.onThemeChangeTrigger.bind(this));
    this.nativeMessenger = new NativeMessenger({
      connected: this.nativeAppConnected.bind(this),
      updateNeeded: this.updateNeeded.bind(this),
      disconnected: this.nativeAppDisconnected.bind(this),
      version: this.validateVersion.bind(this),
      output: Messenger.UI.sendDebuggingOutput.bind(this),
      pywalColorsFetchSuccess: this.onPywalColorsFetchSuccess.bind(this),
      pywalColorsFetchFailed: this.onPywalColorsFetchFailed.bind(this),
      themeModeSet: this.themeModeSet.bind(this),
    });

    browser.commands.onCommand.addListener(this.onCommand.bind(this));
    browser.runtime.onMessage.addListener(this.onMessage.bind(this));
    browser.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    browser.tabs.onRemoved.addListener(this.onTabRemoved.bind(this));
    browser.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    browser.browserAction.onClicked.addListener(() => this.settingsPage.open());
  }

  private getDefaultTemplate() {
    const themeMode = this.state.getThemeMode();

    if (!themeMode) {
      console.error("Failed to get default template: theme mode is not set");
      return null;
    }

    return themeMode === ThemeModes.Dark
      ? DEFAULT_THEME_DARK
      : DEFAULT_THEME_LIGHT;
  }

  private startAutoThemeMode() {
    const { start, end } = this.state.getAutoTimeInterval();
    this.autoMode.start(start, end);
  }

  private setOption(optionData: IOptionSetData) {
    if (!optionData) {
      Messenger.UI.sendDebuggingOutput(
        "Tried to set option, but no data was provided",
        true,
      );
      return;
    }

    switch (optionData.option) {
      case EXTENSION_OPTIONS.WEBSITE_CSS_VARIABLES:
        this.setWebsiteCssVariablesEnabled(optionData);
        break;
      case EXTENSION_OPTIONS.AUTO_TIME_START: /* Fallthrough */
      case EXTENSION_OPTIONS.AUTO_TIME_END:
        this.setAutoTimeInterval(optionData);
        break;
      case EXTENSION_OPTIONS.FETCH_ON_STARTUP:
        this.setFetchOnStartupEnabled(optionData);
        break;
      case EXTENSION_OPTIONS.NATIVE_ERROR_MUTED:
        this.setNativeErrorMuted(optionData);
        break;
      case EXTENSION_OPTIONS.UPDATE_MUTED:
        this.setUpdateMuted(optionData);
        break;
      default:
        Messenger.UI.sendDebuggingOutput(
          `Received unhandled option: ${optionData.option}`,
          true,
        );
    }
  }

  /* Handles extension keybindings set using Firefox */
  private onCommand(command: string) {
    switch (command) {
      case EXTENSION_COMMANDS.FETCH_THEME:
        this.nativeMessenger.requestPywalColors();
        break;
      case EXTENSION_COMMANDS.DISABLE_THEME:
        this.resetThemes();
        break;
      case EXTENSION_COMMANDS.ENABLE_DARK_MODE:
        this.setThemeMode(ThemeModes.Dark);
        break;
      case EXTENSION_COMMANDS.ENABLE_LIGHT_MODE:
        this.setThemeMode(ThemeModes.Light);
        break;
      case EXTENSION_COMMANDS.ENABLE_AUTO_MODE:
        this.setThemeMode(ThemeModes.Auto);
        break;
      default:
        console.warn(`Received unhandled command from Firefox: ${command}`);
    }
  }

  /* Handles incoming messages from the UI and other content scripts. */
  private async onMessage(
    { action, data }: IExtensionMessage,
    sender?: browser.runtime.MessageSender,
  ) {
    switch (action) {
      case EXTENSION_MESSAGES.INITIAL_DATA_GET:
        // If the settings page is open on firefox startup, the initial data will be
        // requested before the state has loaded. To avoid this, we will wait for
        // 'this.stateLoadPromise' to be resolved before sending the data to the page.
        if (this.stateLoadPromise !== null) {
          await this.stateLoadPromise;
        }

        Messenger.UI.sendInitialData(this.state.getInitialData());
        break;
      case EXTENSION_MESSAGES.DEBUGGING_INFO_GET:
        Messenger.UI.sendDebuggingInfo(this.state.getDebuggingInfo());
        break;
      case EXTENSION_MESSAGES.PALETTE_TEMPLATE_SET:
        this.setPaletteTemplate(data);
        break;
      case EXTENSION_MESSAGES.THEME_TEMPLATE_SET:
        this.setThemeTemplate(data);
        break;
      case EXTENSION_MESSAGES.THEME_MODE_SET:
        this.setThemeMode(data);
        break;
      case EXTENSION_MESSAGES.TEMPLATE_THEME_MODE_GET:
        Messenger.UI.sendTemplateThemeMode(this.state.getTemplateThemeMode());
        break;
      case EXTENSION_MESSAGES.THEME_FETCH:
        this.fetchTheme();
        break;
      case EXTENSION_MESSAGES.THEME_DISABLE:
        this.resetThemes();
        break;
      case EXTENSION_MESSAGES.PALETTE_COLOR_SET:
        this.setPaletteColor(data);
        break;
      case EXTENSION_MESSAGES.OPTION_SET:
        this.setOption(data);
        break;
      case EXTENSION_MESSAGES.UPDATE_PAGE_MUTE:
        this.state.setUpdateMuted(true);
        this.updatePage.close();
        break;
      case EXTENSION_MESSAGES.NATIVE_ERROR_PAGE_MUTE:
        this.state.setNativeErrorMuted(true);
        this.nativeErrorPage.close();
        break;
      case EXTENSION_MESSAGES.EXTENSION_THEME_GET:
        Messenger.UI.sendExtensionTheme(this.state.getExtensionTheme());
        break;
      case EXTENSION_MESSAGES.WEBSITE_THEME_GET:
        if (this.stateLoadPromise !== null) {
          await this.stateLoadPromise;
        }

        if (
          this.state.getWebsiteCssVariablesEnabled() &&
          sender?.tab?.id !== undefined
        ) {
          this.websiteThemeTabIds.add(sender.tab.id);
          Messenger.Website.setThemeForTab(
            sender.tab.id,
            this.getWebsiteTheme(),
          );
        }
        break;
      default:
        break;
    }
  }

  private updateBrowserActionIcon(palette: IPalette) {
    const iconPromise = palette
      ? setThemedBrowserActionIcon(palette)
      : resetBrowserActionIcon();

    iconPromise.catch((error) => {
      Messenger.UI.sendDebuggingOutput(
        `Could not update browser action icon: ${error}`,
        true,
      );
    });
  }

  private updateExtensionPagesTheme(extensionTheme: IExtensionTheme) {
    this.settingsPage.setTheme(extensionTheme);
    this.updatePage.setTheme(extensionTheme);
    this.nativeErrorPage.setTheme(extensionTheme);
  }

  private getWebsiteTheme() {
    const colorscheme = this.state.getColorscheme();

    if (!colorscheme) {
      return null;
    }

    if (colorscheme.website) {
      return colorscheme.website;
    }

    if (colorscheme.palette) {
      return Generators.website(colorscheme.palette);
    }

    return null;
  }

  private getWebsiteThemeTabIds() {
    return Array.from(this.websiteThemeTabIds);
  }

  private updateWebsiteTheme(websiteTheme: IExtensionTheme) {
    const tabIds = this.getWebsiteThemeTabIds();

    if (!this.state.getWebsiteCssVariablesEnabled() && websiteTheme) {
      return;
    }

    if (websiteTheme) {
      Messenger.Website.setTheme(tabIds, websiteTheme);
    } else {
      Messenger.Website.resetTheme(tabIds);
    }
  }

  private async registerWebsiteContentScript() {
    if (this.websiteContentScript) {
      return true;
    }

    try {
      this.websiteContentScript =
        await Messenger.Website.registerContentScript();
      return true;
    } catch (error) {
      Messenger.UI.sendDebuggingOutput(
        `Could not register website CSS variables content script: ${error}`,
        true,
      );
      return false;
    }
  }

  private async unregisterWebsiteContentScript() {
    if (!this.websiteContentScript) {
      return;
    }

    await this.websiteContentScript.unregister();
    this.websiteContentScript = null;
  }

  private async injectWebsiteTheme(tabId: number) {
    const injected = await Messenger.Website.injectScript(tabId);

    if (injected && this.state.getWebsiteCssVariablesEnabled()) {
      this.websiteThemeTabIds.add(tabId);
      Messenger.Website.setThemeForTab(tabId, this.getWebsiteTheme());
    }
  }

  private async injectWebsiteThemes() {
    const tabs = await Messenger.Website.getWebsiteTabs();
    const websiteTheme = this.getWebsiteTheme();

    // Inject the content script into each tab and immediately send the theme
    // in the same awaited call — guaranteeing the listener is registered before
    // WEBSITE_THEME_SET arrives. Firing setTheme after a bulk injectScripts()
    // call races against script execution and the message is silently dropped.
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id === undefined) return;
        const injected = await Messenger.Website.injectScriptAndSetTheme(
          tab.id,
          websiteTheme,
        );
        if (injected) {
          this.websiteThemeTabIds.add(tab.id);
        }
      }),
    );
  }

  private onTabUpdated(
    tabId: number,
    changeInfo: browser.tabs._OnUpdatedChangeInfo,
    tab: browser.tabs.Tab,
  ) {
    if (this.state.currentState && changeInfo.status === "loading") {
      this.websiteThemeTabIds.delete(tabId);
    } else if (
      this.state.getWebsiteCssVariablesEnabled() &&
      (changeInfo.status === "complete" || changeInfo.discarded === false) &&
      !tab.discarded &&
      !this.websiteThemeTabIds.has(tabId)
    ) {
      this.injectWebsiteTheme(tabId);
    }
  }

  private async onTabActivated({ tabId }: browser.tabs._OnActivatedActiveInfo) {
    if (!this.state.getWebsiteCssVariablesEnabled()) {
      return;
    }

    try {
      const tab = await browser.tabs.get(tabId);
      if (tab && !tab.discarded && !this.websiteThemeTabIds.has(tabId)) {
        await this.injectWebsiteTheme(tabId);
      }
    } catch (_) {}
  }

  private onTabRemoved(tabId: number) {
    this.websiteThemeTabIds.delete(tabId);
  }

  private fetchTheme() {
    const isConnected = this.state.getConnected();

    if (!isConnected) {
      Messenger.UI.sendNotification(
        "Fetch failed",
        "You are not connected to the RE:fox daemon",
        true,
      );
      return;
    }

    this.nativeMessenger.requestPywalColors();
  }

  private resetThemes() {
    this.updateWebsiteTheme(null);
    browser.theme.reset();
    this.updateBrowserActionIcon(null);
    this.updateExtensionPagesTheme(null);
    this.updateWebsiteTheme(null);

    if (this.state.getThemeMode() === ThemeModes.Auto) {
      this.autoMode.stop();
    }

    this.state.setColors(null, null);
    this.state.setCustomColors(null);
    this.state.setApplied(false);

    Messenger.UI.sendDebuggingOutput("Theme was disabled");
  }

  private setThemes(
    pywalColors: IPywalColors,
    customColors?: Partial<IPalette>,
  ) {
    const mode = this.state.getTemplateThemeMode();
    const template = this.state.getTemplate();
    const colorscheme = Generators.colorscheme(
      mode,
      pywalColors,
      customColors,
      template,
    );

    this.updateWebsiteTheme(colorscheme.website);
    this.setBrowserTheme(colorscheme.browser, mode);
    this.updateBrowserActionIcon(colorscheme.palette);
    this.updateExtensionPagesTheme(colorscheme.extension);
    this.updateWebsiteTheme(colorscheme.website);

    this.state.setColors(pywalColors, colorscheme);
    this.state.setCustomColors(customColors || null);
    this.state.setApplied(true);

    return colorscheme;
  }

  private applyUpdatedPaletteTemplate(template: IPaletteTemplate) {
    const pywalColors = this.state.getPywalColors();
    const customColors = this.state.getCustomColors();

    if (!pywalColors) {
      return;
    }

    // Make sure that a color from the pywal palette is not used as a custom color.
    const filteredCustomColors = customColors;
    if (customColors !== null) {
      Object.keys(filteredCustomColors).forEach((key) => {
        if (filteredCustomColors[key] === pywalColors[template[key]]) {
          delete filteredCustomColors[key];
        }
      });
    }

    this.setThemes(pywalColors, filteredCustomColors);
    Messenger.UI.sendCustomColors(filteredCustomColors);
  }

  private setBrowserTheme(
    browserTheme: IBrowserTheme,
    mode?: ThemeModes.Dark | ThemeModes.Light,
  ) {
    const modeString = mode === ThemeModes.Dark ? "dark" : "light";

    browser.theme.update({
      colors: browserTheme,
      properties: {
        // @ts-ignore
        color_scheme: modeString,
        // @ts-ignore
        content_color_scheme: modeString,
      },
    });
  }

  private async setWebsiteCssVariablesEnabled({
    option,
    enabled,
  }: IOptionSetData) {
    const isEnabled = this.state.getWebsiteCssVariablesEnabled();

    if (enabled && !isEnabled) {
      const registered = await this.registerWebsiteContentScript();

      if (!registered) {
        Messenger.UI.sendOption(option, false);
        Messenger.UI.sendNotification(
          "Website CSS variables",
          "Could not register website CSS variables content script",
          true,
        );
        return;
      }

      this.websiteThemeTabIds.clear();
      await this.state.setWebsiteCssVariablesEnabled(true);
      Messenger.UI.sendOption(option, true);
      await this.injectWebsiteThemes();
      return;
    }

    if (!enabled && isEnabled) {
      this.updateWebsiteTheme(null);
      this.websiteThemeTabIds.clear();
      await this.unregisterWebsiteContentScript();
    }

    await this.state.setWebsiteCssVariablesEnabled(enabled);
    Messenger.UI.sendOption(option, enabled);
  }

  private setFetchOnStartupEnabled({ option, enabled }) {
    this.state.setFetchOnStartupEnabled(enabled);
    Messenger.UI.sendOption(option, enabled);
  }

  private setUpdateMuted({ option, enabled }) {
    this.state.setUpdateMuted(enabled);
    Messenger.UI.sendOption(option, enabled);
  }

  private setNativeErrorMuted({ option, enabled }) {
    this.state.setNativeErrorMuted(enabled);
    Messenger.UI.sendOption(option, enabled);
  }

  private setSavedColorscheme(colorscheme: IColorscheme) {
    console.log("Applying saved colorscheme");
    this.updateWebsiteTheme(this.getWebsiteTheme());
    this.setBrowserTheme(colorscheme.browser);
    this.updateBrowserActionIcon(colorscheme.palette);
    this.updateExtensionPagesTheme(colorscheme.extension);
    this.updateWebsiteTheme(this.getWebsiteTheme());
    this.state.setApplied(true);
  }

  private async onThemeChangeTrigger(isDay: boolean) {
    await this.state.setIsDay(isDay);
    this.updateThemeForCurrentMode();
    Messenger.UI.sendTemplateThemeMode(this.state.getTemplateThemeMode());
    Messenger.UI.sendDebuggingOutput(
      `Theme update triggered by automatic theme mode. Is day: ${isDay}`,
    );
  }

  private updateThemeForCurrentMode() {
    const template = this.state.getTemplate();
    const pywalColors = this.state.getPywalColors();
    const customColors = this.state.getCustomColors();

    Messenger.UI.sendPaletteTemplate(template.palette);
    Messenger.UI.sendThemeTemplate(template.browser);
    Messenger.UI.sendCustomColors(customColors);

    if (pywalColors) {
      return this.setThemes(pywalColors, customColors);
    }

    return null;
  }

  private async setThemeMode(mode: ThemeModes) {
    const currentMode = this.state.getThemeMode();
    const previousTemplateMode = this.state.getTemplateThemeMode();

    if (currentMode === mode) {
      return;
    }

    /**
     * TODO: Change 'setThemeMode' behaviour to allow use without 'await'
     *
     * Doing it this way is not clean and can easily cause bugs, since forgetting
     * to await the promise will give us an invalid template mode.
     *
     * We could return the updated template mode when the state has been updated, e.g:
     * const { templateMode } = await this.state.updateThemeMode(mode);
     */
    await this.state.setThemeMode(mode);

    const newTemplateMode = this.state.getTemplateThemeMode();

    // No need to update the theme if the currently applied theme mode
    // matches the one that will be set by auto-mode.
    if (previousTemplateMode !== newTemplateMode) {
      this.updateThemeForCurrentMode();
    }

    if (mode === ThemeModes.Auto) {
      if (this.state.getApplied()) {
        this.startAutoThemeMode();
      }

      Messenger.UI.sendTemplateThemeMode(newTemplateMode);
    } else {
      this.autoMode.stop();
    }

    Messenger.UI.sendThemeMode(mode, newTemplateMode);
  }

  private setPaletteTemplate(template: IPaletteTemplate) {
    let updatedTemplate: IPaletteTemplate = template;

    if (updatedTemplate === null) {
      updatedTemplate = this.getDefaultTemplate().palette;
    }

    this.state.setPaletteTemplate(updatedTemplate);
    this.applyUpdatedPaletteTemplate(updatedTemplate);

    Messenger.UI.sendPaletteTemplate(updatedTemplate);
  }

  private setThemeTemplate(template: IThemeTemplate) {
    const palette = this.state.getPalette();
    let updatedTemplate = template;

    if (updatedTemplate === null) {
      updatedTemplate = this.getDefaultTemplate().browser;
    }

    if (palette !== null) {
      // Generate a new browser theme only based on the current palette and the new template
      const browserTheme = Generators.browser(palette, updatedTemplate);
      this.setBrowserTheme(browserTheme);
      this.state.setBrowserTheme(browserTheme);
    }

    this.state.setThemeTemplate(updatedTemplate);

    Messenger.UI.sendThemeTemplate(updatedTemplate);
  }

  private setPaletteColor(palette: Partial<IPalette>) {
    const pywalColors = this.state.getPywalColors();

    if (pywalColors !== null) {
      const customPalette = this.createCustomColorPalette(palette);
      this.setThemes(pywalColors, customPalette);
    }
  }

  private setAutoTimeInterval({ option, value }: IOptionSetData) {
    const isApplied = this.state.getApplied();

    if (option === EXTENSION_OPTIONS.AUTO_TIME_START) {
      this.state.setAutoTimeStart(value);
      this.autoMode.setStartTime(value, isApplied);
      Messenger.UI.sendAutoTimeStart(value);
    } else {
      this.state.setAutoTimeEnd(value);
      this.autoMode.setEndTime(value, isApplied);
      Messenger.UI.sendAutoTimeEnd(value);
    }

    Messenger.UI.sendNotification(
      "Auto mode",
      "Light theme interval was updated successfully",
    );
  }

  private createCustomColorPalette(data: Partial<IPalette>) {
    const currentColors = this.state.getCustomColors();

    if (currentColors === null) {
      return data;
    }

    return Object.assign(currentColors, data);
  }

  private validateVersion(version: string) {
    if (parseFloat(version) < MIN_REQUIRED_DAEMON_VERSION) {
      this.updateNeeded();
    }

    this.state.setVersion(version);
  }

  private updateNeeded() {
    if (this.state.getUpdateMuted()) {
      console.log(
        "Update is required, but user has muted update notifications",
      );
      return;
    }

    this.updatePage.open();
  }

  private nativeAppConnected() {
    if (this.state.getApplied() && this.state.getFetchOnStartupEnabled()) {
      this.nativeMessenger.requestPywalColors();
    }

    this.state.setConnected(true);
  }

  private async nativeAppDisconnected(nativeError: INativeAppError) {
    this.state.setConnected(false);
    this.state.resetVersion();
    this.state.setNativeError(nativeError);

    if (!this.state.getNativeErrorMuted()) {
      await this.nativeErrorPage.open();
    }

    Messenger.UI.sendDebuggingInfo({
      version: this.state.getVersion(),
      connected: false,
      nativeError,
    });
  }

  private async onPywalColorsFetchSuccess({ colors }: IPywalData) {
    const pywalPalette = Generators.pywalPalette(colors);
    Messenger.UI.sendDebuggingOutput(
      "Native colors were fetched from daemon and applied successfully",
    );
    Messenger.UI.sendPywalColors(pywalPalette);

    // We must make sure to reset all custom colors for both theme modes or
    // previously selected custom colors will still be active on theme mode switch,
    // even after a Fetch.
    await this.state.resetAllCustomColors();

    this.setThemes(pywalPalette);

    if (this.state.getThemeMode() === ThemeModes.Auto) {
      this.startAutoThemeMode();
    }
  }

  private onPywalColorsFetchFailed(error: string) {
    Messenger.UI.sendNotification("Pywal colors", error, true);
  }

  private themeModeSet(mode: ThemeModes) {
    this.setThemeMode(mode);
  }

  public async start() {
    this.settingsPage = new ExtensionPage(EXTENSION_PAGES.SETTINGS);
    this.updatePage = new ExtensionPage(EXTENSION_PAGES.UPDATE);
    this.nativeErrorPage = new ExtensionPage(EXTENSION_PAGES.NATIVE_ERROR);

    this.stateLoadPromise = this.state.load(
      this.updateThemeForCurrentMode.bind(this),
    );
    await this.stateLoadPromise;
    this.stateLoadPromise = null;

    const isApplied = this.state.getApplied();
    const shouldFetch = this.state.getFetchOnStartupEnabled();
    const isWebsiteCssVariablesEnabled =
      this.state.getWebsiteCssVariablesEnabled();

    this.nativeMessenger.connect();

    // Run this after creating the extension pages so that the themes can be
    // set if the pages were reopened on launch.
    if (isApplied && !shouldFetch) {
      const savedColorscheme = this.state.getColorscheme();
      const currentThemeMode = this.state.getThemeMode();

      if (currentThemeMode === ThemeModes.Auto) {
        this.startAutoThemeMode();
      }

      this.setSavedColorscheme(savedColorscheme);
    }

    if (isWebsiteCssVariablesEnabled) {
      this.registerWebsiteContentScript()
        .then(async (registered) => {
          if (registered) {
            await this.injectWebsiteThemes();
          }
        })
        .catch((error) => {
          Messenger.UI.sendDebuggingOutput(
            `Could not initialize website CSS variables: ${error}`,
            true,
          );
        });
    }
  }
}
