# Changelog

## 0.2.0

New: `Options.labels.ruler` and `setLabels()` — the accessible name of the ruler (a slider) was a fixed English "Time"; give it in your language (default unchanged).

Fixes:
- A timeline with `labelWidth: 0` (no label column) kept a two-column grid, so its scroll area landed in the hidden 0 px column: the ruler could be neither seen nor pressed. It now has a single column.
- `setView()` and the wheel zoom no longer announce a `view` because the browser rounded `scrollLeft` (130.65 becomes 131 at a pixel ratio of 1); API calls are silent again, as documented.
- `setRate()` refreshes the accessible names of the keys (they carry a timecode).
- The ruler and its corner stay at the top of the visible area when there are more rows than fit; a timeline still at its fitted zoom fits again when its width changes (one the person zoomed keeps its zoom).
- Dev: `@types/node` is now a devDependency (the tsconfig asks for it), so `npm run typecheck` works in a standalone checkout; it only worked inside the monorepo, where another package brought it.
- `package.json` declared `"sideEffects": false` while exporting `./style.css`, which consumers import for its effect: a production build could drop the import. It is now `["**/*.css"]`.

## 0.1.1

Fix: the published `style.d.ts` pointed at a bundler-only import (`./style.css?raw`), which broke type-checking for consumers without `skipLibCheck`. The build now checks that no declaration does that and that every file `package.json` points at exists. The package now links to the live demos (`homepage`) and the issue tracker (`bugs`).

## 0.1.0

First version: whole-frame time at a rational rate, SMPTE timecode with drop-frame (29.97, 59.94), adaptive ruler, rows and keys, zoom and scroll, drag with snapping, rectangle selection, keyboard and ARIA, `follow`/`setTime` playhead, quiet API with person-only events, `sync` helper, CSS-variable theming. ~7 KB gzipped, no dependencies.
