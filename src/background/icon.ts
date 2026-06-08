import { IPalette } from '@definitions';

const ICON_SIZES = [16, 32, 48];
const LOGO_TEMPLATE_PATH = 'icons/logo.svg';
const DEFAULT_ICON_PATH = 'icons/logo-accent.svg';
const SVG_COLOR_MAP = {
  '#ed7979': 'background',
  '#edb979': 'backgroundLight',
  '#eded79': 'backgroundExtra',
  '#72e986': 'accentPrimary',
  '#7d8eef': 'accentSecondary',
  '#b179ed': 'text',
  '#000000': 'background',
  '#201912': 'background',
  '#e6dcd3': 'textFocus',
  '#fdfcfb': 'textFocus',
  '#ffffff': 'accentPrimary',
  '#cc6816': 'accentPrimary',
  '#b35c14': 'accentPrimary',
  '#924a10': 'accentSecondary',
};

let logoSvgPromise: Promise<string> = null;

function getLogoSvg() {
  if (logoSvgPromise === null) {
    logoSvgPromise = fetch(browser.runtime.getURL(LOGO_TEMPLATE_PATH)).then((response) => response.text());
  }

  return logoSvgPromise;
}

function createThemedLogoSvg(svg: string, palette: IPalette) {
  const svgWithContextColors = svg
    .replace(/context-fill-opacity/g, '1')
    .replace(/context-stroke-opacity/g, '1')
    .replace(/context-fill/g, palette.accentPrimary)
    .replace(/context-stroke/g, palette.accentPrimary);

  return Object.keys(SVG_COLOR_MAP).reduce((themedSvg, color) => {
    const paletteKey = SVG_COLOR_MAP[color];
    return themedSvg.replace(new RegExp(color, 'gi'), palette[paletteKey]);
  }, svgWithContextColors);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function createThemedIconImageData(palette: IPalette) {
  const svg = await getLogoSvg();
  const image = await loadImage(svgToDataUrl(createThemedLogoSvg(svg, palette)));
  const imageData = {};

  ICON_SIZES.forEach((size) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');

    if (context === null) {
      return;
    }

    context.clearRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    imageData[size] = context.getImageData(0, 0, size, size);
  });

  return imageData;
}

export async function setThemedBrowserActionIcon(palette: IPalette) {
  if (!palette || typeof browser === 'undefined' || !browser.browserAction?.setIcon || typeof document === 'undefined') {
    return;
  }

  const imageData = await createThemedIconImageData(palette);

  if (Object.keys(imageData).length === 0) {
    return;
  }

  await browser.browserAction.setIcon({ imageData });
}

export function resetBrowserActionIcon() {
  if (typeof browser === 'undefined' || !browser.browserAction?.setIcon) {
    return Promise.resolve();
  }

  return browser.browserAction.setIcon({ path: DEFAULT_ICON_PATH });
}
