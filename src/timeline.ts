import { clampDelta, nudgeBy, rowsInBand, snapFrame } from "./interaction";
import { css } from "./style";
import { describeRate, formatTimecode, type FrameRate } from "./timecode";
import { rulerTicks } from "./ticks";
import type { EventMap, Key, KeyMove, KeyRef, Model, Options, Phase, Row } from "./types";
import { clampScroll, fitPxPerFrame, frameToX, visibleRange, xToFrame, zoomAt, type View } from "./view";

const SNAP_PX = 6;
const DRAG_START_PX = 3;
const keyId = (r: KeyRef) => `${r.rowId}\u0000${r.keyId}`;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
};

/**
 * A timeline that marks time. The host owns the clock and the data: the timeline shows them and tells you what the person did.
 *  - time is whole frames at a stated rate (never floating seconds);
 *  - `setTime`/`follow` move the playhead at once, with no event: nothing you do through the API can echo back;
 *  - events (`seek`, `keymove`, `keyadd`, `keyremove`, `select`, `view`) are only the person's actions.
 */
export class Timeline extends EventTarget {
  private readonly host: HTMLElement;
  private readonly o: Required<Pick<Options, "rowHeight" | "labelWidth" | "minLabelPx" | "autoScroll" | "readOnly">> & Options;
  private model: Model = { duration: 0, rows: [] };
  private rate: FrameRate;
  private timeFrame = 0;
  private view: View = { pxPerFrame: 1, scrollFrame: 0, widthPx: 0 };
  private readonly limits: { min: number; max: number };
  private selection = new Map<string, KeyRef>();
  private readonly wrap: HTMLElement;
  private readonly heads: HTMLElement;
  private readonly scroll: HTMLElement;
  private readonly content: HTMLElement;
  private readonly ruler: HTMLElement;
  private readonly rowsEl: HTMLElement;
  private readonly playhead: HTMLElement;
  private readonly box: HTMLElement;
  private headerCleanups: (() => void)[] = [];
  private keyEls = new Map<string, HTMLButtonElement>();
  private spanEls: { el: HTMLElement; start: number; end: number }[] = [];
  private follower: (() => number) | null = null;
  private raf = 0;
  private resize: ResizeObserver | null = null;
  private fitted = false;
  private destroyed = false;
  private pointerOps: (() => void)[] = [];

  constructor(host: HTMLElement, options: Options) {
    super();
    this.host = host;
    this.rate = options.rate;
    this.o = { rowHeight: 22, labelWidth: 160, minLabelPx: 80, autoScroll: false, readOnly: false, ...options };
    this.limits = { min: options.zoom?.min ?? 0.02, max: options.zoom?.max ?? 40 };
    if (options.injectStyles !== false && !document.querySelector("style[data-frameline]")) {
      const style = document.createElement("style");
      style.setAttribute("data-frameline", "");
      style.textContent = css;
      document.head.appendChild(style);
    }
    host.classList.add("fl");
    host.style.setProperty("--fl-label-width", `${this.o.labelWidth}px`);
    this.wrap = host;
    this.heads = el("div", "fl-heads", host);
    this.scroll = el("div", "fl-scroll", host);
    this.content = el("div", "fl-content", this.scroll);
    this.ruler = el("div", "fl-ruler", this.content);
    this.rowsEl = el("div", "fl-rows", this.content);
    this.playhead = el("div", "fl-playhead", this.content);
    this.box = el("div", "fl-box", this.content);
    if (this.o.labelWidth === 0) this.heads.style.display = "none";
    this.ruler.setAttribute("role", "slider");
    this.ruler.setAttribute("aria-label", "Time");
    this.ruler.tabIndex = 0;
    this.bind();
    this.timeFrame = options.time ?? 0;
    if (options.model) this.setModel(options.model);
    this.measure();
    this.resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.measure()) : null;
    this.resize?.observe(this.scroll);
  }

  // ---- the API the host calls (never fires an event) ---------------------------------------------------------------------------------------------

  on<K extends keyof EventMap>(type: K, handler: (detail: EventMap[K]) => void): () => void {
    const listener = (e: Event) => handler((e as CustomEvent<EventMap[K]>).detail);
    this.addEventListener(type, listener);
    return () => this.removeEventListener(type, listener);
  }

  /** The playhead frame (as last set, or moved by the person). */
  get time(): number { return this.timeFrame; }

  setModel(model: Model): void {
    this.model = { duration: Math.max(0, model.duration), rows: model.rows };
    const present = new Set(model.rows.flatMap((r) => r.keys.map((k) => keyId({ rowId: r.id, keyId: k.id }))));
    for (const id of [...this.selection.keys()]) if (!present.has(id)) this.selection.delete(id);
    this.renderHeads();
    this.renderRows();
    this.layout();
    if (!this.fitted && this.view.widthPx > 0) this.fit();
  }

  setRate(rate: FrameRate): void { this.rate = rate; this.renderRuler(); this.paintPlayhead(); }

  /** Moves the playhead now. Fires nothing. A fractional frame is shown as given (smooth), but anything the person seeks is whole. */
  setTime(frame: number): void {
    this.timeFrame = frame;
    this.paintPlayhead();
    if (this.o.autoScroll) this.ensureVisible(frame);
  }

  /** The playhead follows `getFrame()`, read once per display frame: the clock stays yours, nothing is queued, and the playhead can never be more than one frame behind. */
  follow(getFrame: () => number): void {
    this.follower = getFrame;
    const tick = () => {
      if (this.destroyed || this.follower !== getFrame) return;
      const f = getFrame();
      if (f !== this.timeFrame) this.setTime(f);
      this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }

  unfollow(): void { this.follower = null; cancelAnimationFrame(this.raf); }

  /** Sets what is visible: the first frame and/or the zoom. Fires nothing. */
  setView(v: { start?: number; pxPerFrame?: number }): void {
    const ppf = Math.min(this.limits.max, Math.max(this.limits.min, v.pxPerFrame ?? this.view.pxPerFrame));
    this.view = clampScroll({ ...this.view, pxPerFrame: ppf, scrollFrame: v.start ?? this.view.scrollFrame }, this.model.duration);
    this.layout();
    this.scroll.scrollLeft = this.view.scrollFrame * ppf;
  }

  getView(): { start: number; end: number; pxPerFrame: number } {
    const r = visibleRange(this.view);
    return { start: r.start, end: r.end, pxPerFrame: this.view.pxPerFrame };
  }

  /** Zoom so the whole duration fits. */
  fit(): void {
    this.fitted = true;
    this.setView({ pxPerFrame: fitPxPerFrame(this.model.duration, this.view.widthPx, this.limits), start: 0 });
  }

  /** Scrolls only if `frame` is outside the visible part. */
  ensureVisible(frame: number): void {
    const r = visibleRange(this.view);
    if (frame < r.start || frame > r.end) this.setView({ start: frame - (r.end - r.start) * 0.1 });
  }

  select(keys: KeyRef[]): void {
    this.selection = new Map(keys.map((k) => [keyId(k), k]));
    this.paintSelection();
  }

  getSelection(): KeyRef[] { return [...this.selection.values()]; }

  destroy(): void {
    this.destroyed = true;
    this.unfollow();
    this.resize?.disconnect();
    for (const off of this.pointerOps) off();
    for (const c of this.headerCleanups) c();
    this.host.classList.remove("fl");
    this.host.replaceChildren();
  }

  // ---- drawing ---------------------------------------------------------------------------------------------------------------------------------

  private emit<K extends keyof EventMap>(type: K, detail: EventMap[K]): void { this.dispatchEvent(new CustomEvent(type, { detail })); }

  private measure(): void {
    const width = this.scroll.clientWidth;
    if (width === this.view.widthPx) return;
    this.view = { ...this.view, widthPx: width };
    if (!this.fitted && width > 0 && this.model.duration > 0) this.fit(); else this.layout();
  }

  /** The content is as wide as the sequence at this zoom; ticks and keys are placed from the numbers, not measured. */
  private layout(): void {
    this.content.style.width = `${Math.max(this.view.widthPx, this.model.duration * this.view.pxPerFrame)}px`;
    this.rowsEl.style.height = `${this.model.rows.length * this.o.rowHeight}px`;
    for (const [id, el] of this.keyEls) el.style.left = `${this.xOf(id) ?? 0}px`;
    for (const s of this.spanEls) { s.el.style.left = `${s.start * this.view.pxPerFrame}px`; s.el.style.width = `${Math.max(1, (s.end - s.start) * this.view.pxPerFrame)}px`; }
    this.renderRuler();
    this.paintPlayhead();
  }

  private xOf(id: string): number | null {
    const [rowId, key] = id.split("\u0000") as [string, string];
    const k = this.model.rows.find((r) => r.id === rowId)?.keys.find((x) => x.id === key);
    return k ? k.frame * this.view.pxPerFrame : null;
  }

  private labelOf(frame: number, step: number): string {
    if (this.o.labelFormat) return this.o.labelFormat(frame, { rate: this.rate, step });
    const nominal = describeRate(this.rate).nominal;
    const tc = formatTimecode(frame, this.rate); // HH:MM:SS:FF
    const [hh, mm, ss, ff] = [tc.slice(0, 2), tc.slice(3, 5), tc.slice(6, 8), tc.slice(9, 11)];
    if (step < nominal) return `${Number(ss)}:${ff}`;
    return hh !== "00" ? `${Number(hh)}:${mm}:${ss}` : `${Number(mm)}:${ss}`;
  }

  private renderRuler(): void {
    const t = rulerTicks(visibleRange(this.view), this.view.pxPerFrame, this.rate, this.o.minLabelPx);
    const frag = document.createDocumentFragment();
    for (const f of t.minor) { const n = el("span", "fl-tick minor"); n.style.left = `${f * this.view.pxPerFrame}px`; frag.appendChild(n); }
    for (const f of t.major) {
      const n = el("span", "fl-tick major");
      n.style.left = `${f * this.view.pxPerFrame}px`;
      el("em", "", n).textContent = this.labelOf(f, t.step);
      frag.appendChild(n);
    }
    this.ruler.replaceChildren(frag);
  }

  private paintPlayhead(): void {
    this.playhead.style.transform = `translateX(${this.timeFrame * this.view.pxPerFrame}px)`;
    this.ruler.setAttribute("aria-valuemin", "0");
    this.ruler.setAttribute("aria-valuemax", String(this.model.duration));
    this.ruler.setAttribute("aria-valuenow", String(Math.round(this.timeFrame)));
    this.ruler.setAttribute("aria-valuetext", formatTimecode(this.timeFrame, this.rate));
  }

  private renderHeads(): void {
    for (const c of this.headerCleanups) c();
    this.headerCleanups = [];
    this.heads.replaceChildren();
    el("div", "fl-corner", this.heads);
    for (const row of this.model.rows) {
      const head = el("div", `fl-head ${row.className ?? ""}`.trim(), this.heads);
      head.style.height = `${this.o.rowHeight}px`;
      head.dataset.row = row.id;
      if (this.o.renderHeader) { const clean = this.o.renderHeader(row, head); if (clean) this.headerCleanups.push(clean); }
      else head.textContent = row.label ?? "";
    }
  }

  private renderRows(): void {
    this.keyEls.clear();
    this.spanEls = [];
    this.rowsEl.replaceChildren();
    for (const row of this.model.rows) {
      const rowEl = el("div", `fl-row ${row.className ?? ""}`.trim(), this.rowsEl);
      rowEl.style.height = `${this.o.rowHeight}px`;
      rowEl.dataset.row = row.id;
      for (const [name, value] of Object.entries(row.attrs ?? {})) rowEl.setAttribute(name, value);
      for (const span of row.spans ?? []) {
        const s = el("div", `fl-span ${span.className ?? ""}`.trim(), rowEl);
        s.dataset.span = span.id;
        if (span.title) s.title = span.title;
        for (const [name, value] of Object.entries(span.attrs ?? {})) s.setAttribute(name, value);
        this.spanEls.push({ el: s, start: span.start, end: span.end });
        s.style.left = `${span.start * this.view.pxPerFrame}px`;
        s.style.width = `${Math.max(1, (span.end - span.start) * this.view.pxPerFrame)}px`;
      }
      for (const key of row.keys) {
        const k = el("button", `fl-key ${key.className ?? ""}`.trim(), rowEl);
        k.type = "button";
        k.dataset.row = row.id; k.dataset.key = key.id; k.dataset.frame = String(key.frame);
        k.setAttribute("aria-label", `${row.label ?? row.id}: ${formatTimecode(key.frame, this.rate)}`);
        if (key.title) k.title = key.title;
        for (const [name, value] of Object.entries(key.attrs ?? {})) k.setAttribute(name, value);
        k.style.left = `${key.frame * this.view.pxPerFrame}px`;
        k.setAttribute("aria-pressed", String(this.selection.has(keyId({ rowId: row.id, keyId: key.id }))));
        this.keyEls.set(keyId({ rowId: row.id, keyId: key.id }), k);
      }
    }
  }

  private paintSelection(): void {
    for (const [id, node] of this.keyEls) node.setAttribute("aria-pressed", String(this.selection.has(id)));
  }

  // ---- what the person does ----------------------------------------------------------------------------------------------------------------------

  private frameAt(clientX: number): number {
    const x = clientX - this.content.getBoundingClientRect().left;
    return Math.min(this.model.duration, Math.max(0, Math.round(x / this.view.pxPerFrame)));
  }

  private listen<T extends EventTarget>(target: T, type: string, handler: (e: any) => void, options?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, options);
    this.pointerOps.push(() => target.removeEventListener(type, handler, options));
  }

  private bind(): void {
    // the ruler: press and drag to move the playhead, whole frames; arrows, Home and End from the keyboard
    this.listen(this.ruler, "pointerdown", (e: PointerEvent) => {
      this.ruler.setPointerCapture(e.pointerId);
      const seek = (phase: Phase, ev: PointerEvent) => { const frame = this.frameAt(ev.clientX); this.timeFrame = frame; this.paintPlayhead(); this.emit("seek", { frame, phase }); };
      seek("start", e);
      const move = (ev: PointerEvent) => seek("move", ev);
      const up = (ev: PointerEvent) => { seek("end", ev); this.ruler.removeEventListener("pointermove", move); this.ruler.removeEventListener("pointerup", up); this.ruler.removeEventListener("pointercancel", up); };
      this.ruler.addEventListener("pointermove", move); this.ruler.addEventListener("pointerup", up); this.ruler.addEventListener("pointercancel", up);
      e.preventDefault();
    });
    this.listen(this.ruler, "keydown", (e: KeyboardEvent) => {
      const nominal = describeRate(this.rate).nominal;
      let frame = Math.round(this.timeFrame);
      if (e.key === "Home") frame = 0; else if (e.key === "End") frame = this.model.duration;
      else { const by = nudgeBy(e.key, e.shiftKey, nominal); if (by === 0) return; frame += by; }
      frame = Math.min(this.model.duration, Math.max(0, frame));
      e.preventDefault();
      this.timeFrame = frame; this.paintPlayhead();
      this.emit("seek", { frame, phase: "end" });
    });

    // zoom with Ctrl/Cmd + wheel around the pointer; plain scrolling is the browser's own
    this.listen(this.scroll, "wheel", (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const x = e.clientX - this.scroll.getBoundingClientRect().left;
      this.view = zoomAt(this.view, Math.exp(-e.deltaY * 0.002), x, this.limits, this.model.duration);
      this.layout();
      this.scroll.scrollLeft = this.view.scrollFrame * this.view.pxPerFrame;
      this.emitView();
    }, { passive: false });
    this.listen(this.scroll, "scroll", () => {
      const scrollFrame = this.scroll.scrollLeft / this.view.pxPerFrame;
      if (Math.abs(scrollFrame - this.view.scrollFrame) < 1e-6) return; // set by us (setView/zoom): not the person's
      this.view = { ...this.view, scrollFrame };
      this.renderRuler();
      this.emitView();
    });

    // the rows: double-click adds, a drag on empty space selects with a rectangle, a press on a key selects and moves
    this.listen(this.rowsEl, "dblclick", (e: MouseEvent) => {
      if (this.o.readOnly) return;
      if ((e.target as HTMLElement).closest(".fl-key")) return;
      // the row comes from the position, not from the event target: after a press that captured the pointer the target is the container
      const index = Math.floor((e.clientY - this.rowsEl.getBoundingClientRect().top) / this.o.rowHeight);
      const row = this.model.rows[index];
      if (row) this.emit("keyadd", { rowId: row.id, frame: this.frameAt(e.clientX) });
    });
    this.listen(this.rowsEl, "pointerdown", (e: PointerEvent) => {
      const keyEl = (e.target as HTMLElement).closest<HTMLButtonElement>(".fl-key");
      if (keyEl) this.pressKey(e, keyEl); else this.pressSpace(e);
    });
    this.listen(this.rowsEl, "keydown", (e: KeyboardEvent) => {
      const keyEl = (e.target as HTMLElement).closest<HTMLButtonElement>(".fl-key");
      if (!keyEl) return;
      const ref = { rowId: keyEl.dataset.row!, keyId: keyEl.dataset.key! };
      if ((e.key === "Delete" || e.key === "Backspace") && !this.o.readOnly) {
        e.preventDefault();
        this.emit("keyremove", { keys: this.selection.has(keyId(ref)) ? this.getSelection() : [ref] });
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !this.o.readOnly) {
        e.preventDefault();
        if (!this.selection.has(keyId(ref))) { this.selection = new Map([[keyId(ref), ref]]); this.paintSelection(); this.emit("select", { keys: this.getSelection() }); }
        const by = nudgeBy(e.key, e.shiftKey, describeRate(this.rate).nominal);
        const moves = this.movesFor(clampDelta(this.getSelection().map((r) => this.keyOf(r)!.frame), by, 0, this.model.duration), null);
        if (moves.length) this.emit("keymove", { moves, phase: "end" });
      }
    });
    this.listen(this.rowsEl, "click", (e: MouseEvent) => {
      if (e.detail !== 0) return; // a mouse click was handled on pointerdown; this is Enter/Space on a focused key
      const keyEl = (e.target as HTMLElement).closest<HTMLButtonElement>(".fl-key");
      if (keyEl) this.toggle({ rowId: keyEl.dataset.row!, keyId: keyEl.dataset.key! }, true);
    });
  }

  private emitView(): void { this.emit("view", this.getView()); }

  private keyOf(r: KeyRef): Key | undefined { return this.model.rows.find((x) => x.id === r.rowId)?.keys.find((k) => k.id === r.keyId); }

  private toggle(ref: KeyRef, additive: boolean): void {
    const id = keyId(ref);
    if (additive) { if (this.selection.has(id)) this.selection.delete(id); else this.selection.set(id, ref); }
    else if (!(this.selection.size === 1 && this.selection.has(id))) this.selection = new Map([[id, ref]]);
    this.paintSelection();
    this.emit("select", { keys: this.getSelection() });
  }

  /** The moves that apply `delta` frames to the selection (or to `grabbed` only if nothing is selected). */
  private movesFor(delta: number, _grabbed: KeyRef | null): KeyMove[] {
    if (delta === 0) return [];
    return this.getSelection().flatMap((r) => { const k = this.keyOf(r); return k ? [{ ...r, from: k.frame, to: k.frame + delta }] : []; });
  }

  private pressKey(e: PointerEvent, keyEl: HTMLButtonElement): void {
    const grabbed: KeyRef = { rowId: keyEl.dataset.row!, keyId: keyEl.dataset.key! };
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (!this.selection.has(keyId(grabbed)) || additive) this.toggle(grabbed, additive);
    if (this.o.readOnly || !this.selection.has(keyId(grabbed))) return;
    const startX = e.clientX, grabbedFrame = this.keyOf(grabbed)!.frame;
    const moving = this.getSelection();
    const frames = moving.map((r) => this.keyOf(r)!.frame);
    const moveIds = new Set(moving.map(keyId));
    let dragging = false, delta = 0;
    const thresholdFrames = (typeof this.o.snap === "number" ? this.o.snap : this.o.snap === false ? 0 : SNAP_PX) / this.view.pxPerFrame;
    keyEl.setPointerCapture(e.pointerId);
    const currentMoves = () => moving.map((r) => ({ ...r, from: this.keyOf(r)!.frame, to: this.keyOf(r)!.frame + delta }));
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) < DRAG_START_PX) return;
      const wasDragging = dragging;
      dragging = true;
      const raw = grabbedFrame + (ev.clientX - startX) / this.view.pxPerFrame;
      const targets = [this.timeFrame, 0, this.model.duration, ...this.model.rows.flatMap((row) => row.keys.filter((k) => !moveIds.has(keyId({ rowId: row.id, keyId: k.id }))).map((k) => k.frame))];
      const snapped = ev.altKey ? Math.round(raw) : snapFrame(raw, targets, thresholdFrames);
      delta = clampDelta(frames, snapped - grabbedFrame, 0, this.model.duration);
      for (const r of moving) this.keyEls.get(keyId(r))!.style.transform = `translateX(${delta * this.view.pxPerFrame}px) rotate(45deg)`;
      keyEl.classList.add("dragging");
      this.emit("keymove", { moves: currentMoves(), phase: wasDragging ? "move" : "start" });
    };
    const onUp = () => {
      keyEl.removeEventListener("pointermove", onMove); keyEl.removeEventListener("pointerup", onUp); keyEl.removeEventListener("pointercancel", onUp);
      keyEl.classList.remove("dragging");
      for (const r of moving) { const n = this.keyEls.get(keyId(r)); if (n) n.style.transform = ""; }
      if (dragging && delta !== 0) this.emit("keymove", { moves: currentMoves(), phase: "end" });
    };
    keyEl.addEventListener("pointermove", onMove); keyEl.addEventListener("pointerup", onUp); keyEl.addEventListener("pointercancel", onUp);
  }

  private pressSpace(e: PointerEvent): void {
    if (!(e.target as HTMLElement).closest(".fl-row")) return;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const origin = this.content.getBoundingClientRect();
    const rowsTop = this.rowsEl.getBoundingClientRect().top;
    const x0 = e.clientX - origin.left, y0 = e.clientY - rowsTop;
    const base = additive ? new Map(this.selection) : new Map<string, KeyRef>();
    let dragging = false;
    this.rowsEl.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const x1 = ev.clientX - origin.left, y1 = ev.clientY - rowsTop;
      if (!dragging && Math.hypot(x1 - x0, y1 - y0) < DRAG_START_PX) return;
      dragging = true;
      Object.assign(this.box.style, { display: "block", left: `${Math.min(x0, x1)}px`, width: `${Math.abs(x1 - x0)}px`, top: `${this.ruler.offsetHeight + Math.min(y0, y1)}px`, height: `${Math.abs(y1 - y0)}px` });
      const rows = new Set(rowsInBand(y0, y1, this.o.rowHeight, this.model.rows.length));
      const f0 = Math.min(x0, x1) / this.view.pxPerFrame, f1 = Math.max(x0, x1) / this.view.pxPerFrame;
      const next = new Map(base);
      this.model.rows.forEach((row, i) => { if (rows.has(i)) for (const k of row.keys) if (k.frame >= f0 && k.frame <= f1) next.set(keyId({ rowId: row.id, keyId: k.id }), { rowId: row.id, keyId: k.id }); });
      this.selection = next;
      this.paintSelection();
    };
    const onUp = () => {
      this.rowsEl.removeEventListener("pointermove", onMove); this.rowsEl.removeEventListener("pointerup", onUp); this.rowsEl.removeEventListener("pointercancel", onUp);
      this.box.style.display = "none";
      if (!dragging && !additive) this.selection = new Map(); // a click on empty space clears
      this.paintSelection();
      this.emit("select", { keys: this.getSelection() });
    };
    this.rowsEl.addEventListener("pointermove", onMove); this.rowsEl.addEventListener("pointerup", onUp); this.rowsEl.addEventListener("pointercancel", onUp);
  }
}

export type { Row };
