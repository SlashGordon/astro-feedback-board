// Starts the local dev environment: prepares D1, then runs the Worker and the demo site.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const worker = `${root}worker`;

function step(label, args) {
  console.log(`\n▸ ${label}`);
  const result = spawnSync("npx", args, { cwd: worker, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(`${worker}/.dev.vars`)) {
  copyFileSync(`${worker}/.dev.vars.example`, `${worker}/.dev.vars`);
  console.log("▸ Created worker/.dev.vars from .dev.vars.example");
}
step("Applying D1 migrations", ["wrangler", "d1", "migrations", "apply", "feedback", "--local"]);
step("Seeding demo site", ["wrangler", "d1", "execute", "feedback", "--local", "--file", "seed/dev.sql"]);

console.log(`
▸ Worker:  http://localhost:8787   (admin: http://localhost:8787/admin)
▸ Demo:    http://localhost:4321
`);

const children = [
  spawn("npx", ["wrangler", "dev", "--port", "8787"], { cwd: worker, stdio: "inherit" }),
  // --ignore-lock keeps Astro in the foreground even when it detects a coding agent.
  spawn("npx", ["astro", "dev", "--port", "4321", "--ignore-lock"], { cwd: `${root}demo`, stdio: "inherit" }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGINT");
  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const child of children) child.on("exit", (code) => stop(code ?? 0));
