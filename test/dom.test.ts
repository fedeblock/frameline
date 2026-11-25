// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Timeline } from "../src/timeline";
import type { EventMap, Model, Options } from "../src/types";

/*
 * The DOM layer, driven the way a person drives it: pointers on the rows, keys on a focused mark. jsdom has no layout, so the geometry is given: the scroll area is
 * 1000 px wide and the timeline 1000 frames long, so it fits at exactly one pixel per frame (clientX = frame) and every number below can be read off.
 */

const WIDTH = 1000;
const ROW_HEIGHT = 20;
const RATE = { n: 25, d: 1 };

const PE: typeof PointerEvent = (globalThis.PointerEvent ?? class extends MouseEvent {
  readonly pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; }
}) as typeof PointerEvent;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get(this: HTMLElement) { return this.classList.contains("fl-scroll") ? WIDTH : 0; } });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) { return { left: 0, top: 0, right: WIDTH, bottom: ROW_HEIGHT, width: WIDTH, height: ROW_HEIGHT, x: 0, y: 0, toJSON() { return {}; } } as DOMRect; };
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

const model = (over: { editable?: boolean; spans?: Model["rows"][number]["spans"] } = {}): Model => ({
  duration: 1000,
  rows: [{
    id: "r", label: "Row", keys: [{ id: "k1", frame: 300 }, { id: "k2", frame: 700 }],
    spans: over.spans ?? [{ id: "s", start: 100, end: 200, editable: over.editable ?? true, title: "a clip" }],
  }],
});

type Heard = { [K in keyof EventMap]?: EventMap[K][] };
let current: Timeline | null = null;
let host: HTMLElement | null = null;

function mount(m: Model = model(), options: Partial<Options> = {}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const timeline = new Timeline(host, { rate: RATE, model: m, injectStyles: false, rowHeight: ROW_HEIGHT, ...options });
  current = timeline;
  const heard: Heard = {};
  for (const type of ["seek", "keymove", "keyadd", "keyremove", "select", "spanmove"] as const) timeline.on(type, (d) => { ((heard[type] ??= []) as unknown[]).push(d); });
  return { timeline, heard };
}

afterEach(() => { current?.destroy(); current = null; host?.remove(); host = null; });

const spanEl = () => host!.querySelector<HTMLElement>('.fl-span[data-span="s"]')!;
const handle = (edge: "start" | "end") => spanEl().querySelector<HTMLElement>(`.fl-span-handle.${edge}`)!;
const down = (el: Element, x: number, init: PointerEventInit = {}) => el.dispatchEvent(new PE("pointerdown", { bubbles: true, clientX: x, clientY: 5, pointerId: 1, button: 0, ...init }));
const move = (x: number, init: PointerEventInit = {}) => window.dispatchEvent(new PE("pointermove", { bubbles: true, clientX: x, clientY: 5, pointerId: 1, ...init }));
const up = (x: number, init: PointerEventInit = {}) => window.dispatchEvent(new PE("pointerup", { bubbles: true, clientX: x, clientY: 5, pointerId: 1, ...init }));
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: k, ...init }));

describe("what a span looks like", () => {
  it("an editable span is a focusable group with a handle on each edge, named by its title", () => {
    mount();
    expect(spanEl().classList.contains("editable")).toBe(true);
    expect(spanEl().tabIndex).toBe(0);
    expect(spanEl().getAttribute("role")).toBe("group");
    expect(spanEl().getAttribute("aria-label")).toBe("a clip");
    expect(spanEl().querySelectorAll(".fl-span-handle")).toHaveLength(2);
    expect(spanEl().style.left).toBe("100px");
    expect(spanEl().style.width).toBe("100px");
  });

  it("a span that is not editable has no handles, cannot be focused and does nothing when pressed", () => {
    const { heard } = mount(model({ editable: false }));
    expect(spanEl().classList.contains("editable")).toBe(false);
    expect(spanEl().querySelectorAll(".fl-span-handle")).toHaveLength(0);
    expect(spanEl().tabIndex).toBe(-1);
    down(spanEl(), 150); move(220); up(220);
    expect(heard.spanmove).toBeUndefined();
  });
});

describe("dragging the body of a span", () => {
  it("moves it: start, move and end are announced with where it was and where it would be, and the timeline draws the proposal until you answer", () => {
    const { heard } = mount();
    down(spanEl(), 150);
    move(180);
    expect(spanEl().style.left).toBe("130px");                                          // the preview follows the pointer…
    expect(spanEl().classList.contains("dragging")).toBe(true);
    move(200);
    up(200);
    expect(heard.spanmove!.map((e) => e.phase)).toEqual(["start", "move", "end"]);
    expect(heard.spanmove!.at(-1)).toMatchObject({ rowId: "r", spanId: "s", edge: "move", from: { start: 100, end: 200 }, to: { start: 150, end: 250 }, phase: "end" });
    expect(spanEl().style.left).toBe("100px");                                          // …and it is back where the model says: the host decides by calling setModel
    expect(spanEl().classList.contains("dragging")).toBe(false);
  });

  it("does not change what it is told about: the model is the host's", () => {
    const { timeline } = mount();
    down(spanEl(), 150); move(230); up(230);
    timeline.setModel(model({ spans: [{ id: "s", start: 180, end: 280, editable: true }] }));   // the host accepted
    expect(spanEl().style.left).toBe("180px");
  });

  it("a press that hardly moves is a click, not a drag", () => {
    const { heard } = mount();
    down(spanEl(), 150); move(152); up(152);
    expect(heard.spanmove).toBeUndefined();
  });

  it("stops at both ends of the sequence, keeping its length", () => {
    const { heard } = mount();
    down(spanEl(), 150); move(-500); up(-500);
    expect(heard.spanmove!.at(-1)!.to).toEqual({ start: 0, end: 100 });
    down(spanEl(), 150); move(5000); up(5000);
    expect(heard.spanmove!.at(-1)!.to).toEqual({ start: 900, end: 1000 });
  });

  it("is pulled to a key or the end of another span within six pixels, and Alt turns that off", () => {
    const { heard } = mount();
    down(spanEl(), 150); move(150 + 98); up(150 + 98);                                   // the end would land on 298: the key at 300 pulls it
    expect(heard.spanmove!.at(-1)!.to).toEqual({ start: 200, end: 300 });
    down(spanEl(), 150, { altKey: true }); move(150 + 98, { altKey: true }); up(150 + 98, { altKey: true });
    expect(heard.spanmove!.at(-1)!.to).toEqual({ start: 198, end: 298 });
  });

  it("an editable span's double click adds nothing, an empty place on the row does", () => {
    const { heard } = mount();
    spanEl().dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 150, clientY: 5 }));
    expect(heard.keyadd).toBeUndefined();
    host!.querySelector(".fl-rows")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 500, clientY: 5 }));
    expect(heard.keyadd).toEqual([{ rowId: "r", frame: 500 }]);
  });
});

describe("stretching a span from its edges", () => {
  it("the end handle moves only the end, the start handle only the start", () => {
    const { heard } = mount();
    down(handle("end"), 200); move(240); up(240);
    expect(heard.spanmove!.at(-1)).toMatchObject({ edge: "end", from: { start: 100, end: 200 }, to: { start: 100, end: 240 } });
    down(handle("start"), 100); move(60); up(60);
    expect(heard.spanmove!.at(-1)).toMatchObject({ edge: "start", to: { start: 60, end: 200 } });
  });

  it("never makes it shorter than its minimum length, nor past the sequence", () => {
    const { heard } = mount(model({ spans: [{ id: "s", start: 100, end: 200, editable: true, minLength: 25 }] }));
    down(handle("end"), 200); move(0); up(0);
    expect(heard.spanmove!.at(-1)!.to).toEqual({ start: 100, end: 125 });
    down(handle("end"), 200); move(5000); up(5000);
    expect(heard.spanmove!.at(-1)!.to).toEqual({ start: 100, end: 1000 });
  });
});

describe("a drag that outlives the element", () => {
  it("is not lost when the host redraws the row in the middle of it (the clip counts arriving, for one): the end is still announced and nothing is left half-dragged", () => {
    const { timeline, heard } = mount();
    down(spanEl(), 150); move(190);
    const before = spanEl();
    timeline.setModel(model());                                                         // the rows are rebuilt: the element the person grabbed is gone
    expect(spanEl()).not.toBe(before);
    move(200); up(200);
    expect(heard.spanmove!.at(-1)).toMatchObject({ phase: "end", to: { start: 150, end: 250 } });
    expect(spanEl().classList.contains("dragging")).toBe(false);
    expect(spanEl().style.left).toBe("100px");
  });

  it("follows only the pointer that started it: a second finger does not move it or end it", () => {
    const { heard } = mount();
    down(spanEl(), 150, { pointerId: 1 });
    move(400, { pointerId: 2 });
    up(400, { pointerId: 2 });
    expect(heard.spanmove).toBeUndefined();
    move(180, { pointerId: 1 }); up(180, { pointerId: 1 });
    expect(heard.spanmove!.at(-1)!.to).toEqual({ start: 130, end: 230 });
  });

  it("is dropped when the timeline is destroyed: nothing is heard afterwards, nothing is left listening on the window", () => {
    const { timeline, heard } = mount();
    down(spanEl(), 150); move(190);
    const before = heard.spanmove!.length;
    timeline.destroy();
    current = null;
    move(300); up(300);
    expect(heard.spanmove!.length).toBe(before);
  });

  it("once it ends, later pointer moves are nobody's business", () => {
    const { heard } = mount();
    down(spanEl(), 150); move(190); up(190);
    const n = heard.spanmove!.length;
    move(300); up(300);
    expect(heard.spanmove!.length).toBe(n);
  });
});

describe("the keyboard on a focused span", () => {
  it("an arrow moves it one frame, Shift a second (the nominal rate), Alt+arrow stretches its end", () => {
    const { heard } = mount();
    key(spanEl(), "ArrowRight");
    expect(heard.spanmove!.at(-1)).toMatchObject({ edge: "move", phase: "end", from: { start: 100, end: 200 }, to: { start: 101, end: 201 } });
    key(spanEl(), "ArrowLeft", { shiftKey: true });
    expect(heard.spanmove!.at(-1)!.to).toEqual({ start: 75, end: 175 });
    key(spanEl(), "ArrowRight", { altKey: true });
    expect(heard.spanmove!.at(-1)).toMatchObject({ edge: "end", to: { start: 100, end: 201 } });
  });

  it("says nothing when it cannot move (at the start of the sequence), and nothing at all when the timeline is read-only", () => {
    const edge = mount(model({ spans: [{ id: "s", start: 0, end: 50, editable: true }] }));
    key(spanEl(), "ArrowLeft");
    expect(edge.heard.spanmove).toBeUndefined();
    edge.timeline.destroy(); current = null; host!.remove();
    const ro = mount(model(), { readOnly: true });
    key(spanEl(), "ArrowRight"); down(spanEl(), 150); move(230); up(230);
    expect(ro.heard.spanmove).toBeUndefined();
  });
});

describe("the events are the person's, not the host's", () => {
  it("setModel redraws and announces nothing", () => {
    const { timeline, heard } = mount();
    timeline.setModel(model({ spans: [{ id: "s", start: 300, end: 400, editable: true }] }));
    expect(heard.spanmove).toBeUndefined();
    expect(heard.keymove).toBeUndefined();
    expect(heard.select).toBeUndefined();
  });
});

describe("the marks and the ruler (what was there before spans)", () => {
  const keyEl = (id: string) => host!.querySelector<HTMLElement>(`.fl-key[data-key="${id}"]`)!;

  it("pressing the ruler seeks to the frame under the pointer, a whole frame, with its phases", () => {
    const { heard } = mount();
    const ruler = host!.querySelector(".fl-ruler")!;
    down(ruler, 250);
    expect(heard.seek!.at(0)).toMatchObject({ frame: 250 });
  });

  it("pressing a key selects it, and dragging it announces the move and a change you answer by calling setModel", () => {
    const { heard } = mount();
    down(keyEl("k1"), 300);
    expect(heard.select!.at(-1)!.keys).toEqual([{ rowId: "r", keyId: "k1" }]);
    expect(keyEl("k1").getAttribute("aria-pressed")).toBe("true");
    keyEl("k1").dispatchEvent(new PE("pointermove", { bubbles: true, clientX: 350, pointerId: 1 }));
    keyEl("k1").dispatchEvent(new PE("pointerup", { bubbles: true, clientX: 350, pointerId: 1 }));
    expect(heard.keymove!.at(-1)).toMatchObject({ phase: "end", moves: [{ rowId: "r", keyId: "k1", from: 300, to: 350 }] });
  });

  it("Delete on a selected key asks to remove it, and an arrow nudges it one frame", () => {
    const { heard } = mount();
    down(keyEl("k2"), 700);
    key(keyEl("k2"), "ArrowRight");
    expect(heard.keymove!.at(-1)).toMatchObject({ phase: "end", moves: [{ keyId: "k2", from: 700, to: 701 }] });
    key(keyEl("k2"), "Delete");
    expect(heard.keyremove!.at(-1)!.keys).toEqual([{ rowId: "r", keyId: "k2" }]);
  });

  it("read-only: keys neither move nor are removed, but they can still be selected and the ruler still seeks", () => {
    const { heard } = mount(model(), { readOnly: true });
    down(keyEl("k1"), 300);
    keyEl("k1").dispatchEvent(new PE("pointermove", { bubbles: true, clientX: 350, pointerId: 1 }));
    keyEl("k1").dispatchEvent(new PE("pointerup", { bubbles: true, clientX: 350, pointerId: 1 }));
    key(keyEl("k1"), "Delete");
    expect(heard.keymove).toBeUndefined();
    expect(heard.keyremove).toBeUndefined();
    down(host!.querySelector(".fl-ruler")!, 100);
    expect(heard.seek).toBeDefined();
  });
});
