export interface IPywalColors extends Array<string> {
  [index: number]: string;
}

export interface IPywalData {
  colors: IPywalColors;
  wallpaper: string;
}

export interface IExtendedPywalColorBase {
  targetIndex: number;
}

export interface ICustomPywalColor extends IExtendedPywalColorBase {
  colorString: string;
}

export interface IModifiedPywalColor extends IExtendedPywalColorBase {
  colorIndex: number;
  modifier: number;
  min?: number;
  max?: number;
}

export type IExtendedPywalColor = IModifiedPywalColor | ICustomPywalColor;
export type IExtendedPywalColors = IExtendedPywalColor[];

export type IPaletteHash = string;

export enum PaletteColors {
  Background = "background",
  BackgroundLight = "backgroundLight",
  BackgroundExtra = "backgroundExtra",
  AccentPrimary = "accentPrimary",
  AccentSecondary = "accentSecondary",
  Text = "text",
  TextFocus = "textFocus",
}

export enum ThemeModes {
  Dark = "dark",
  Light = "light",
  Auto = "auto",
}

export enum NativeAppErrors {
  ManifestNotInstalled,
  UnexpectedError,
  Unknown,
  None,
}

export type ITemplateThemeMode = Exclude<ThemeModes, ThemeModes.Auto>;

export interface IBrowserTheme {
  icons: string;
  icons_attention: string;
  frame: string;
  frame_inactive: string;
  tab_text: string;
  tab_loading: string;
  tab_background_text: string;
  tab_selected: string;
  tab_line: string;
  tab_background_separator: string;
  toolbar: string;
  toolbar_text: string;
  toolbar_field: string;
  toolbar_field_focus: string;
  toolbar_field_text: string;
  toolbar_field_text_focus: string;
  toolbar_field_border: string;
  toolbar_field_border_focus: string;
  toolbar_field_separator: string;
  toolbar_field_highlight: string;
  toolbar_field_highlight_text: string;
  toolbar_bottom_separator: string;
  toolbar_top_separator: string;
  toolbar_vertical_separator: string;
  ntp_background: string;
  ntp_text: string;
  ntp_card_background: string;
  popup: string;
  popup_border: string;
  popup_text: string;
  popup_highlight: string;
  popup_highlight_text: string;
  sidebar: string;
  sidebar_border: string;
  sidebar_text: string;
  sidebar_highlight: string;
  sidebar_highlight_text: string;
  button_background_hover: string;
  button_background_active: string;
}

export type IExtensionTheme = string;

export interface IColorscheme {
  hash: IPaletteHash;
  palette: IPalette;
  browser: IBrowserTheme;
  extension: IExtensionTheme;
  website: IExtensionTheme;
}

export interface IThemeTemplate {
  [key: string]: PaletteColors;
}

export type IPalette = Record<PaletteColors, string>;

export type IPaletteTemplate = Record<PaletteColors, number>;

export interface IColorschemeTemplate {
  palette: IPaletteTemplate;
  browser: IThemeTemplate;
}

export type TemplateTypes = IPaletteTemplate | IThemeTemplate;

export type ColorschemeTypes =
  IPalette | IPaletteHash | IBrowserTheme | IExtensionTheme;

export type ICustomColors = Record<ITemplateThemeMode, Partial<IPalette>>;

export type IColorschemeTemplates = Record<
  ITemplateThemeMode,
  IColorschemeTemplate
>;

export interface IExtensionOptions {
  websiteCssVariables: boolean;
  fetchOnStartup: boolean;
  autoTimeStart: ITimeIntervalEndpoint;
  autoTimeEnd: ITimeIntervalEndpoint;
  updateMuted: boolean;
  nativeErrorMuted: boolean;
}

export interface IExtensionMessage {
  action: string;
  data?: any;
}

export type IExtensionMessageCallback = (message: IExtensionMessage) => void;

export interface IOptionSetData {
  option: string;
  enabled: boolean;
  value?: any;
  skipConfirmation?: boolean;
}

export interface IThemeModeData {
  mode: ThemeModes;
  templateMode: ITemplateThemeMode;
}

export interface INativeAppError {
  type: NativeAppErrors;
  message: string;
}

export interface INativeAppMessage {
  action: string;
  success: boolean;
  error?: string;
  data?: any;
}

export interface INativeAppRequest {
  action: string;
  target?: string;
  size?: number;
}

export interface INativeAppMessageCallbacks {
  connected: () => void;
  updateNeeded: () => void;
  disconnected: (nativeError: INativeAppError) => void;
  version: (version: string) => void;
  output: (message: string, error?: boolean) => void;
  pywalColorsFetchSuccess: (pywalData: IPywalData) => void;
  pywalColorsFetchFailed: (error: string) => void;
  themeModeSet: (mode: ThemeModes) => void;
}

export interface INodeLookup {
  [key: string]: HTMLElement;
}

export interface IInitialData {
  isApplied: boolean;
  pywalColors: IPywalColors;
  template: IColorschemeTemplate;
  customColors: Partial<IPalette>;
  themeMode: ThemeModes;
  templateThemeMode: ITemplateThemeMode;
  debuggingInfo: IDebuggingInfoData;
  options: IOptionSetData[];
  autoTimeInterval: ITimeIntervalEndpoints;
}

export interface IDebuggingInfoData {
  version: string;
  connected: boolean;
  nativeError: INativeAppError;
}

export interface INotificationData {
  title: string;
  message: string;
  error: boolean;
}

export interface ITemplateItem {
  title: string;
  description: string;
  target: string;
  cssVariable?: string;
}

export interface ITimeIntervalEndpoint {
  hour: number;
  minute: number;
  stringFormat: string;
}

export interface ITimeIntervalEndpoints {
  start: ITimeIntervalEndpoint;
  end: ITimeIntervalEndpoint;
}

export type IAutoModeTriggerCallback = (isDay: boolean) => void;

export interface IExtensionState {
  version: string;
  connected: boolean;
  nativeError: INativeAppError;
  theme: {
    mode: ThemeModes;
    isDay: boolean;
    isApplied: boolean;
    pywalColors: IPywalColors;
    colorscheme: IColorscheme;
    customColors: ICustomColors;
    templates: IColorschemeTemplates;
  };
  options: IExtensionOptions;
}
