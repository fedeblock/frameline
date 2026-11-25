# Changelog

## 0.3.0

New: **editable spans.** A `Span` with `editable: true` is drawn taller with a handle on each edge; the person moves it by dragging its body and stretches it from an edge, and you hear it on the new `spanmove` event (`phase` `start`/`move`/`end`, like `keymove`: preview while dragging, commit on `end`, the model changes only when you call `setModel`). `Span.minLength` (frames, default 1) limits the stretch. Snapping, Alt to turn it off, keyboard (arrows move a focused span, Alt+arrows stretch its end) and `readOnly` work as for keys. Pure helpers exported: `dragSpan`, `snapSpanDelta`. Spans that are not `editable` are unchanged (drawn behind the keys, not interactive). The drag is followed on the window (not on the element), so a `setModel` that redraws the rows in the middle of it does not lose it, only the pointer that started it counts, and `destroy()` during a drag leaves nothing listening.

Dev: DOM tests (`test/dom.test.ts`, jsdom 30.1.3 as a pinned devDependency; jsdom has no layout, so the tests give it one: 1000 px, 1000 frames, one pixel per frame) for spans, keys, the ruler and the read-only mode.

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
