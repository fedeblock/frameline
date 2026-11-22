import raw from "./style.css?raw";

/** The default look (`src/style.css`, also shipped as `dist/style.css`). Every colour and size is a CSS variable on `.fl`: set them on the host element to restyle; or ignore it (`injectStyles: false`). */
export const css: string = raw; // typed here so the published declaration says `string`, not where the bundler read it from
