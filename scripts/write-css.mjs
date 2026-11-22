// Writes the default stylesheet as dist/style.css, for pages that cannot inject <style> (strict CSP).
import { writeFileSync } from "node:fs";
import { defaultCss } from "../dist/frameline.js";
writeFileSync(new URL("../dist/style.css", import.meta.url), defaultCss.trim() + "\n");
console.log("dist/style.css written");
