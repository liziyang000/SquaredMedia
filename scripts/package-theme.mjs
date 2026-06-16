import { rmSync, mkdirSync, cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const themeName = "pingfangvideo";
const source = path.join(root, "template", themeName);
const dist = path.join(root, "dist");
const packageRoot = path.join(dist, themeName);
const archive = path.join(dist, `${themeName}.tar.gz`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(source, packageRoot, {
  recursive: true,
  filter: (sourcePath) => !path.basename(sourcePath).startsWith("."),
});
execFileSync("tar", ["-czf", archive, "-C", dist, themeName], { stdio: "inherit" });

console.log(`Created ${archive}`);
