// Copies the Next.js standalone build (made with DESKTOP_BUILD=1 npm run build) into desktop/server,
// which electron-builder ships as the app's bundled server.
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const standaloneDir = path.join(repoRoot, ".next", "standalone");
const target = path.resolve(import.meta.dirname, "..", "server");

if (!existsSync(path.join(standaloneDir, "server.js"))) {
  throw new Error("No standalone build found. Run `DESKTOP_BUILD=1 npm run build` in the repository root first.");
}

rmSync(target, { recursive: true, force: true });
cpSync(standaloneDir, target, { recursive: true, verbatimSymlinks: true });
cpSync(path.join(repoRoot, ".next", "static"), path.join(target, ".next", "static"), { recursive: true });
cpSync(path.join(repoRoot, "public"), path.join(target, "public"), { recursive: true });
console.log(`Desktop server prepared in ${target}`);
