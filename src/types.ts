import type { FrameRate } from "./timecode";

/** A mark on a row. `frame` is a whole frame number: time in frameline is always frames at the stated rate, never floating seconds. */
export interface Key {
  id: string;
  frame: number;
  /** Extra class(es) on the key's element, for your own colours or shapes. */
  className?: string;
  /** Tooltip. */
  title?: string;
  /** Anything of yours; frameline never reads it. */
  data?: unknown;
  /** Attributes put on the key's element (`data-testid`, `data-…`). */
  attrs?: Record<string, string>;
}

/** A stretch of time on a row (a hold, a stop, a clip): drawn behind the keys, not interactive. */
export interface Span {
  id: string;
  start: number;
  end: number;
  className?: string;
  title?: string;
  attrs?: Record<string, string>;
}

export interface Row {
  id: string;
  label?: string;
  className?: string;
  keys: Key[];
  spans?: Span[];
  /** Attributes put on the row's element. */
  attrs?: Record<string, string>;
}

export interface Model {
  /** Length in frames (the ruler and the scroll end here). */
  duration: number;
  rows: Row[];
}

export interface KeyRef { rowId: string; keyId: string }
export interface KeyMove extends KeyRef { from: number; to: number }
export type Phase = "start" | "move" | "end";

/** Everything the timeline tells you. Only what the PERSON does is announced: calling `setTime`, `setModel`, `setView` or `select` never fires an event. */
export interface EventMap {
  /** The playhead was moved by the person (ruler, arrow keys). `frame` is always a whole frame. */
  seek: { frame: number; phase: Phase };
  /** Keys are being moved (or were nudged). Preview on `move`, commit on `end`: the timeline never changes your model, it shows the proposal until you answer with `setModel`. */
  keymove: { moves: KeyMove[]; phase: Phase };
  /** Double-click on a row. */
  keyadd: { rowId: string; frame: number };
  /** Delete or Backspace on a selection. */
  keyremove: { keys: KeyRef[] };
  /** The selection changed by the person's hand. */
  select: { keys: KeyRef[] };
  /** The visible part changed by the person's hand (scroll, zoom). */
  view: { start: number; end: number; pxPerFrame: number };
}

export interface Options {
  /** Needed for the ruler's labels and the Shift-arrow jump. Use `{ n: 30000, d: 1001 }` for 29.97. */
  rate: FrameRate;
  model?: Model;
  /** Initial playhead frame. Default 0. */
  time?: number;
  /** Height of a row in px. Default 22. */
  rowHeight?: number;
  /** Width of the row-label column in px (0 hides it). Default 160. */
  labelWidth?: number;
  /** Space the ruler leaves between two labels, in px. Default 80. */
  minLabelPx?: number;
  /** Zoom limits in px per frame. Default 0.02 to 40. */
  zoom?: { min?: number; max?: number };
  /** Snap a dragged key to other keys and the playhead within this many px (`true` = 6, `false` = off). Default true. Hold Alt while dragging to turn it off. */
  snap?: boolean | number;
  /** No dragging, adding or removing; scrubbing still works. */
  readOnly?: boolean;
  /** Keep the playhead in view when it is moved by `setTime`/`follow`. Default false. */
  autoScroll?: boolean;
  /** Put the default stylesheet in the page (once). Default true; turn it off and import `frameline/style.css` yourself under a strict CSP. */
  injectStyles?: boolean;
  /** The text of a ruler label. Default: seconds (`1:05`), or `SS:FF` when the marks are closer than a second. */
  labelFormat?(frame: number, context: { rate: FrameRate; step: number }): string;
  /** Fill a row's label cell (add buttons, icons…). Return a function to clean up. Default: the row's `label` as text. */
  renderHeader?(row: Row, element: HTMLElement): void | (() => void);
}
