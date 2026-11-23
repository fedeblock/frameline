import { Timeline, formatTimecode, type FrameRate, type KeyMove, type Model } from "../src/index";

/*
 * The pattern frameline is built for: the HOST owns the clock and the data; the timeline shows them and reports what the person did.
 *   person -> timeline event -> host updates its clock/model -> host tells every view through the quiet API (no events come back).
 */

// ---- the host's clock: one source of truth, counted in frames at a stated rate ---------------------------------------------------------------
const DURATION_SECONDS = 90;
let rate: FrameRate = { n: 30000, d: 1001 };
const fps = () => rate.n / rate.d;
const clock = {
  playing: false,
  baseFrame: 0,       // the frame at `startedAt`
  startedAt: 0,       // performance.now() when playback started
  frame(): number {
    if (!this.playing) return this.baseFrame;
    return Math.floor(this.baseFrame + ((performance.now() - this.startedAt) / 1000) * fps()) % durationFrames();
  },
  seek(frame: number) { this.baseFrame = frame; this.startedAt = performance.now(); },
  play() { this.baseFrame = this.frame(); this.startedAt = performance.now(); this.playing = true; },
  pause() { this.baseFrame = this.frame(); this.playing = false; },
};
const durationFrames = () => Math.round(DURATION_SECONDS * fps());

// ---- the host's data -------------------------------------------------------------------------------------------------------------------------
let nextId = 100;
const model: Model = { duration: durationFrames(), rows: [
  { id: "camera", label: "Camera", keys: [0, 12, 27, 41, 60, 85].map((s, i) => ({ id: `c${i}`, frame: Math.round(s * fps()) })) },
  { id: "clouds", label: "Clouds · mode", keys: [0, 30, 66].map((s, i) => ({ id: `m${i}`, frame: Math.round(s * fps()) })) },
  { id: "front", label: "Front · opacity", keys: [5, 18, 45, 70].map((s, i) => ({ id: `f${i}`, frame: Math.round(s * fps()) })) },
  { id: "card", label: "Card · visible", keys: [14, 19, 27, 32].map((s, i) => ({ id: `k${i}`, frame: Math.round(s * fps()) })) },
  { id: "stops", label: "City stops", keys: [], spans: [{ id: "s1", start: Math.round(14 * fps()), end: Math.round(19 * fps()) }, { id: "s2", start: Math.round(27 * fps()), end: Math.round(32 * fps()) }] },
] };

// ---- three views of the same time ----------------------------------------------------------------------------------------------------------
const main = new Timeline(document.getElementById("main")!, { rate, model, snap: true });
const overview = new Timeline(document.getElementById("overview")!, { rate, model, rowHeight: 6, labelWidth: 160, readOnly: true, minLabelPx: 140, renderHeader: (_r, el) => { el.textContent = ""; } });
// a bare transport strip: no label column (labelWidth 0), the ruler and the playhead only
const transport = new Timeline(document.getElementById("transport")!, { rate, model, rowHeight: 6, labelWidth: 0, minLabelPx: 140, labels: { ruler: "Playhead" } });
for (const t of [main, overview, transport]) t.follow(() => clock.frame()); // pulled once per display frame: no timers, no queue, never more than a frame behind

// ---- what the person does, and what the host answers --------------------------------------------------------------------------------------
const logEl = document.getElementById("log")!;
const lines: string[] = [];
const say = (type: string, detail: unknown) => { lines.unshift(`${type} ${JSON.stringify(detail)}`); lines.length = Math.min(lines.length, 9); logEl.textContent = lines.join("\n"); };

for (const t of [main, overview, transport]) {
  t.on("seek", ({ frame, phase }) => { say("seek", { frame, phase }); clock.seek(frame); });   // the host's clock moves; both views follow it
}
main.on("keymove", ({ moves, phase }) => {
  say("keymove", { phase, moves: moves.map((m) => `${m.rowId}/${m.keyId} ${m.from}→${m.to}`) });
  if (phase === "end") apply(moves);                                                           // commit: the model is the host's to change
});
main.on("keyadd", ({ rowId, frame }) => { say("keyadd", { rowId, frame }); model.rows.find((r) => r.id === rowId)?.keys.push({ id: `n${nextId++}`, frame }); refresh(); });
main.on("keyremove", ({ keys }) => { say("keyremove", { keys: keys.map((k) => `${k.rowId}/${k.keyId}`) }); for (const k of keys) { const row = model.rows.find((r) => r.id === k.rowId); if (row) row.keys = row.keys.filter((x) => x.id !== k.keyId); } refresh(); });
main.on("select", ({ keys }) => say("select", { count: keys.length }));
main.on("view", ({ start, pxPerFrame }) => say("view", { start: Math.round(start), pxPerFrame: +pxPerFrame.toFixed(3) }));

function apply(moves: KeyMove[]) { for (const m of moves) { const k = model.rows.find((r) => r.id === m.rowId)?.keys.find((x) => x.id === m.keyId); if (k) k.frame = m.to; } refresh(); }
const copy = (): Model => ({ ...model, rows: model.rows.map((r) => ({ ...r, keys: [...r.keys], spans: r.spans?.map((s) => ({ ...s })) })) });
function refresh() { main.setModel(copy()); overview.setModel(copy()); transport.setModel(copy()); }

// ---- the page's own controls -------------------------------------------------------------------------------------------------------------------
const tc = document.getElementById("tc")!;
const play = document.getElementById("play")!;
play.addEventListener("click", () => { if (clock.playing) { clock.pause(); play.textContent = "▶ Play"; } else { clock.play(); play.textContent = "❚❚ Pause"; } });
document.getElementById("fit")!.addEventListener("click", () => main.fit());
document.getElementById("rate")!.addEventListener("change", (e) => {
  const [n, d] = (e.target as HTMLSelectElement).value.split("/").map(Number) as [number, number];
  const oldFps = fps(), was = clock.frame() / oldFps;   // keep every instant (in seconds) across the change
  rate = { n, d };
  model.duration = durationFrames();
  for (const row of model.rows) {
    for (const k of row.keys) k.frame = Math.min(model.duration, Math.round((k.frame / oldFps) * fps()));
    for (const s of row.spans ?? []) { s.start = Math.round((s.start / oldFps) * fps()); s.end = Math.round((s.end / oldFps) * fps()); }
  }
  clock.seek(Math.round(was * fps()));
  main.setRate(rate); overview.setRate(rate); transport.setRate(rate); refresh(); main.fit(); overview.fit(); transport.fit();
});
const readout = () => { tc.textContent = formatTimecode(clock.frame(), rate); requestAnimationFrame(readout); };
readout();

(window as unknown as { __demo: unknown }).__demo = { main, overview, transport, clock, model, lines, format: formatTimecode, get rate() { return rate; } };
