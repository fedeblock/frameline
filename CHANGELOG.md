# Changelog

## 0.1.1

Fix: the published `style.d.ts` pointed at a bundler-only import (`./style.css?raw`), which broke type-checking for consumers without `skipLibCheck`. The build now checks that no declaration does that and that every file `package.json` points at exists. The package now links to the live demos (`homepage`) and the issue tracker (`bugs`).

## 0.1.0

First version: whole-frame time at a rational rate, SMPTE timecode with drop-frame (29.97, 59.94), adaptive ruler, rows and keys, zoom and scroll, drag with snapping, rectangle selection, keyboard and ARIA, `follow`/`setTime` playhead, quiet API with person-only events, `sync` helper, CSS-variable theming. ~7 KB gzipped, no dependencies.
