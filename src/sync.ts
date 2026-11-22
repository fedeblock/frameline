import type { Timeline } from "./timeline";

/**
 * Keeps several timelines (or a timeline and anything else) in step. What the person does on one is applied to the others through the quiet API
 * (`setTime`, `setView`), which fires no event, so there is nothing to echo and no loop to guard against. Returns the function that unlinks them.
 */
export function sync(timelines: readonly Timeline[], what: { time?: boolean; view?: boolean } = { time: true, view: true }): () => void {
  const offs: (() => void)[] = [];
  for (const source of timelines) {
    const others = timelines.filter((t) => t !== source);
    if (what.time !== false) offs.push(source.on("seek", ({ frame }) => others.forEach((t) => t.setTime(frame))));
    if (what.view !== false) offs.push(source.on("view", ({ start, pxPerFrame }) => others.forEach((t) => t.setView({ start, pxPerFrame }))));
  }
  return () => offs.forEach((off) => off());
}
