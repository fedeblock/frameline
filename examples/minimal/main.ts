// The smallest useful setup. In your own project: import { Timeline, formatTimecode } from "frameline";
import { Timeline, formatTimecode, type Model } from "../../src/index";

const rate = { n: 25, d: 1 };
const model: Model = {
  duration: 25 * 30, // 30 seconds, in frames
  rows: [
    { id: "camera", label: "Camera", keys: [{ id: "a", frame: 0 }, { id: "b", frame: 250 }] },
    { id: "graphics", label: "Graphics", keys: [{ id: "c", frame: 100 }] },
  ],
};

const timeline = new Timeline(document.getElementById("timeline")!, { rate, model });
const readout = document.getElementById("tc")!;

// The clock is ours: a frame number we set. The timeline only shows it and tells us what the person does.
let frame = 0;
const show = (f: number) => { frame = f; timeline.setTime(f); readout.textContent = formatTimecode(f, rate); };
timeline.on("seek", ({ frame }) => show(frame));

// Keys: the timeline proposes, we decide. Answering with setModel is what makes a change real.
let next = 0;
timeline.on("keymove", ({ moves, phase }) => {
  if (phase !== "end") return;
  for (const m of moves) model.rows.find((r) => r.id === m.rowId)!.keys.find((k) => k.id === m.keyId)!.frame = m.to;
  timeline.setModel({ ...model });
});
timeline.on("keyadd", ({ rowId, frame }) => { model.rows.find((r) => r.id === rowId)!.keys.push({ id: `n${next++}`, frame }); timeline.setModel({ ...model }); });
timeline.on("keyremove", ({ keys }) => {
  for (const k of keys) { const row = model.rows.find((r) => r.id === k.rowId)!; row.keys = row.keys.filter((x) => x.id !== k.keyId); }
  timeline.setModel({ ...model });
});

show(frame);
