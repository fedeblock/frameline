import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { sideEffects?: boolean | string[]; exports: Record<string, unknown> };

describe("the package declaration", () => {
  it("does not tell bundlers that the stylesheet it asks consumers to import is free to drop (code review)", () => {
    expect(pkg.exports["./style.css"]).toBeTruthy();          // consumers with a strict CSP `import "frameline/style.css"` for its side effect
    expect(pkg.sideEffects).not.toBe(false);                  // `false` lets a production build remove that import and leave the timeline unstyled
    expect(pkg.sideEffects).toContain("**/*.css");
  });
});
