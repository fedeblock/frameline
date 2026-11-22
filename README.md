# frameline

A small timeline for **marking time**. Frame-exact, SMPTE timecode (drop-frame included), keys on rows, and a synchronization model built so the clock stays yours.

- **~7 KB gzipped**, no dependencies, plain DOM. Works with any framework (or none).
- **Time is whole frames at a stated rate.** Never floating seconds: `29.97` is `{ n: 30000, d: 1001 }`, and `00:01:00;02` is exactly frame 1800.
- **Controlled and quiet.** You own the clock and the data. The timeline shows them and reports what the *person* did. Anything you do through the API fires no event, so nothing can echo back.
- Zoom, scroll, snapping, multi-select, keyboard, ARIA, restyling with CSS variables.

```
npm i frameline
```

```ts
import { Timeline } from "frameline";

const timeline = new Timeline(document.querySelector("#timeline")!, {
  rate: { n: 30000, d: 1001 },                       // 29.97
  model: { duration: 2697, rows: [
    { id: "camera", label: "Camera", keys: [{ id: "a", frame: 0 }, { id: "b", frame: 360 }] },
  ] },
});

// the clock is yours: the playhead follows it, read once per display frame
timeline.follow(() => myClock.frame());

// the person scrubs: move YOUR clock; every view that follows it will show it
timeline.on("seek", ({ frame }) => myClock.seek(frame));

// the person moves keys: preview on "move", commit on "end" — by answering with a new model
timeline.on("keymove", ({ moves, phase }) => { if (phase === "end") { applyToMyData(moves); timeline.setModel(myModel()); } });
```

Run the demo: `npm run demo` (in `packages/timeline`). It shows two timelines kept in step by one clock, an event log, and the rate switch between 25, 29.97 DF, 50 and 59.94 DF.

## Synchronization

A timeline's job is to say *when*. These are the decisions that keep it honest.

| Choice | Why |
| --- | --- |
| **Frames, not seconds.** Every time in the API is a whole frame at the rate you gave. | Float seconds drift and cannot name a frame at 29.97. Whole frames compare with `===` and survive a round trip through timecode. |
| **The host owns the clock.** The timeline never keeps time: no timers, no `Date.now()`. | Playback belongs to your player, video element, audio context or network source. One source of truth. |
| **Push for discrete changes, pull for playback.** `setTime(frame)` moves the playhead at once; `follow(() => frame)` reads your clock once per display frame. | Playback at 60 Hz needs no state updates in your framework and no queue: the playhead is drawn from the clock's value in the same display frame, so it can never be more than **one frame behind**. |
| **Events are only the person's actions.** `seek`, `keymove`, `keyadd`, `keyremove`, `select`, `view`. API calls (`setTime`, `setModel`, `setView`, `select`, `setRate`) are silent. | No echo, no loop guard, no “who changed it” flag. Two timelines (or a timeline and a video) cannot ping-pong. |
| **Controlled data.** The timeline never edits your model. It shows a *proposal* while a key is dragged (`keymove` with `phase: "move"`) and applies nothing until you answer with `setModel`. | Your undo/redo, validation and persistence stay yours; refusing a change is just not calling `setModel`: the key is drawn where your model says. |
| **Phases.** `seek` and `keymove` carry `"start" | "move" | "end"`. | Preview and cheap work on `move`; commit and expensive work (save, undo step) on `end`. |
| **View is state too.** `view` events and `setView()` let you keep several timelines (or a waveform) scrolled and zoomed together. | `sync([a, b])` wires time and view in a few lines. |

### Keeping other things in step

- **Two timelines on one clock:** have both `follow` the same function. **One drives the other:** `sync([a, b])`.
- **A video or audio element:** `timeline.follow(() => Math.round(video.currentTime * fps))`, and on `seek` set `video.currentTime = frame / fps`.
- **Several windows** (e.g. an editor and an operator console): publish `seek`/`keymove` over `BroadcastChannel` (or a WebSocket), and apply what arrives with the *quiet* API on the other side. Because the API fires no event, applying a message never re-publishes it.
- **A network clock (LTC/NTP/PTP bridge):** your code converts it to a frame number; `follow` does the rest.

What frameline does **not** do, on purpose: play, keep time, resolve conflicts between sources, or buffer. Those are the clock's job, and a small timeline that tries them stops being small.

## API

### `new Timeline(element, options)`

| Option | Default | |
| --- | --- | --- |
| `rate` | *(required)* | `{ n, d }`, e.g. `{ n: 25, d: 1 }`, `{ n: 60000, d: 1001 }` |
| `model` | | `{ duration, rows }`; `duration` in frames |
| `time` | `0` | initial playhead frame |
| `rowHeight` | `22` | px |
| `labelWidth` | `160` | px of the row-label column; `0` hides it |
| `minLabelPx` | `80` | minimum space between ruler labels |
| `zoom` | `{ min: 0.02, max: 40 }` | px per frame |
| `snap` | `true` | snap a dragged key to other keys and the playhead within 6 px (a number sets the px, `false` turns it off); **Alt** turns it off while dragging |
| `readOnly` | `false` | no dragging, adding or removing; scrubbing still works |
| `autoScroll` | `false` | keep the playhead in view when moved through the API |
| `injectStyles` | `true` | put the default stylesheet in the page; with a strict CSP use `false` and import `frameline/style.css` |
| `labelFormat(frame, { rate, step })` | seconds, or `SS:FF` when zoomed in | the text of a ruler label |
| `renderHeader(row, element)` | the row's label | fill a row's label cell (buttons, icons); return a cleanup function |

### Methods (all silent)

`setModel(model)` · `setRate(rate)` · `setTime(frame)` · `follow(getFrame)` / `unfollow()` · `setView({ start?, pxPerFrame? })` · `getView()` · `fit()` · `ensureVisible(frame)` · `select(keys)` / `getSelection()` · `on(type, handler)` (returns an unsubscribe function; it is also an `EventTarget`) · `destroy()` · `time` (the playhead frame)

### Events (only the person's actions)

| Event | Detail |
| --- | --- |
| `seek` | `{ frame, phase }`, whole frames |
| `keymove` | `{ moves: [{ rowId, keyId, from, to }], phase }`, with the snapped proposal; arrows nudge one frame (Shift: a second), reported with `phase: "end"` |
| `keyadd` | `{ rowId, frame }` (double-click) |
| `keyremove` | `{ keys: [{ rowId, keyId }] }` (Delete / Backspace) |
| `select` | `{ keys }` |
| `view` | `{ start, end, pxPerFrame }` |

### Timecode

`formatTimecode(frame, rate)`, `parseTimecode(text, rate)` and `describeRate(rate)` are exported. 29.97 and 59.94 are **drop-frame** (`00:01:00;02`: frame numbers, never frames, are skipped); 23.976 is counted at 24. The test suite compares every frame of two hours at 25, 50, 24, 30, 60, 29.97 DF and 59.94 DF with [`smpte-timecode`](https://www.npmjs.com/package/smpte-timecode) (a development dependency only).

### Keyboard and pointer

| | |
| --- | --- |
| Press / drag the ruler | move the playhead |
| ← → on the ruler | ±1 frame (**Shift** ±1 s); Home / End |
| Click a key; **Shift**/**⌘**/**Ctrl** + click | select; add to the selection |
| Drag a key | move the selection (snaps; **Alt** off) |
| Drag on empty space | rectangle selection (**Shift** adds) |
| ← → on a key | nudge the selection one frame (**Shift**: a second); Delete removes |
| Double-click a row | add a key there |
| **Ctrl/⌘** + wheel | zoom around the pointer; plain scroll pans |

Keys are `<button>`s (`aria-pressed` when selected) and the ruler is a `role="slider"` with `aria-valuetext` in timecode.

### Restyling

Everything is a CSS variable on the host element (`--fl-bg`, `--fl-row`, `--fl-line`, `--fl-text`, `--fl-head`, `--fl-key`, `--fl-key-selected`, `--fl-playhead`, `--fl-box`, `--fl-ruler-height`, `--fl-key-size`, `--fl-font`), the classes are stable (`.fl-ruler`, `.fl-row`, `.fl-key`, `.fl-head`, `.fl-playhead`…), and `Key`/`Row` take a `className`.

## Not in 0.1

Easing/curve editing, vertical virtualization for thousands of rows, nested groups, touch gestures beyond the pointer events, and a React wrapper (the vanilla class is ~10 lines to wrap).

## Credits

The interaction ideas — snapping while dragging and selecting with a rectangle — come from using and reading [TweenTime](https://github.com/idflood/TweenTime), [Timeliner](https://github.com/zz85/timeliner) and [animation-timeline-js](https://github.com/ievgennaida/animation-timeline-control). No code was copied.

## License

MIT
