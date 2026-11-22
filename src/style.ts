/** The default look. Every colour and size is a CSS variable on `.fl`: set them on the host element to restyle; or ignore this file entirely (`injectStyles: false`). */
export const css = `
.fl{--fl-bg:#0b1320;--fl-row:#101a2b;--fl-line:#1e2c44;--fl-text:#8fa3bf;--fl-head:#e6edf7;--fl-key:#4da3ff;--fl-key-selected:#f2b84b;--fl-playhead:#ff6b6b;--fl-box:#4da3ff33;--fl-ruler-height:24px;--fl-key-size:9px;--fl-font:11px/1.2 system-ui,sans-serif;
  position:relative;display:grid;grid-template-columns:var(--fl-label-width,160px) minmax(0,1fr);background:var(--fl-bg);color:var(--fl-text);font:var(--fl-font);overflow-y:auto;user-select:none;-webkit-user-select:none}
.fl-heads{border-right:1px solid var(--fl-line)}
.fl-corner{height:var(--fl-ruler-height);border-bottom:1px solid var(--fl-line)}
.fl-head{display:flex;align-items:center;gap:6px;padding:0 8px;box-sizing:border-box;border-top:1px solid var(--fl-line);color:var(--fl-head);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fl-scroll{position:relative;overflow-x:auto;overflow-y:hidden;min-width:0}
.fl-content{position:relative}
.fl-ruler{position:relative;height:var(--fl-ruler-height);border-bottom:1px solid var(--fl-line);cursor:ew-resize;outline:none;touch-action:none}
.fl-ruler:focus-visible{box-shadow:inset 0 0 0 2px var(--fl-key)}
.fl-tick{position:absolute;bottom:0;width:1px;background:#33445f;pointer-events:none}
.fl-tick.minor{height:4px}.fl-tick.major{height:10px;background:var(--fl-text)}
.fl-tick em{position:absolute;left:4px;bottom:0;font-style:normal;white-space:nowrap;font-variant-numeric:tabular-nums}
.fl-row{position:relative;box-sizing:border-box;border-top:1px solid var(--fl-line);touch-action:pan-x}
.fl-row:nth-child(even){background:var(--fl-row)}
.fl-span{position:absolute;top:50%;height:4px;margin-top:-2px;border-radius:2px;background:var(--fl-span,#2f6b52);pointer-events:none}
.fl-key{position:absolute;top:50%;width:var(--fl-key-size);height:var(--fl-key-size);margin:calc(var(--fl-key-size) / -2) 0 0 calc(var(--fl-key-size) / -2);padding:0;border:0;border-radius:1px;background:var(--fl-key);transform:rotate(45deg);cursor:grab;touch-action:none}
.fl-key:hover{filter:brightness(1.25)}
.fl-key:focus-visible{outline:2px solid #fff;outline-offset:2px}
.fl-key[aria-pressed="true"]{background:var(--fl-key-selected);box-shadow:0 0 0 1.5px #fff}
.fl-key.dragging{cursor:grabbing}
.fl-playhead{position:absolute;top:0;bottom:0;left:0;width:0;pointer-events:none;will-change:transform}
.fl-playhead::before{content:"";position:absolute;top:0;bottom:0;left:0;width:1px;background:var(--fl-playhead)}
.fl-playhead::after{content:"";position:absolute;top:0;left:-4px;border:4px solid transparent;border-top-color:var(--fl-playhead)}
.fl-box{position:absolute;display:none;background:var(--fl-box);border:1px solid var(--fl-key);pointer-events:none}
`;
