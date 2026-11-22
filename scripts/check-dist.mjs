// Run after the build: what is published must be usable by a plain TypeScript or Node consumer.
import { existsSync, readdirSync, readFileSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const problems = [];
for (const file of readdirSync(dist).filter((f) => f.endsWith(".d.ts"))) {
  if (/\?raw|\.css["']/.test(readFileSync(new URL(file, dist), "utf8"))) problems.push(`${file}: a declaration points at a bundler-only import`);
}
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const wanted = [pkg.main, pkg.module, pkg.types, pkg.exports["."].import, pkg.exports["."].types, pkg.exports["./style.css"]];
for (const path of wanted) if (!existsSync(new URL("../" + path.replace(/^\.\//, ""), import.meta.url))) problems.push(`package.json points at ${path}, which is not built`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log("dist ok");
