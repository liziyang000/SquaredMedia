import { chmodSync, cpSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const packageName = "pingfanggames-server";
const packageRoot = path.join(dist, packageName);
const archive = path.join(dist, `${packageName}.tar.gz`);
const source = path.join(root, "services", "game-server");
const wsSource = path.join(root, "node_modules", "ws");

function normalizePermissions(directory) {
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      chmodSync(filePath, 0o755);
      normalizePermissions(filePath);
    } else if (stats.isFile()) {
      chmodSync(filePath, 0o644);
    }
  }
}

mkdirSync(dist, { recursive: true });
rmSync(packageRoot, { recursive: true, force: true });
rmSync(archive, { force: true });
cpSync(source, packageRoot, {
  recursive: true,
  filter: (sourcePath) => !path.basename(sourcePath).startsWith(".")
});
mkdirSync(path.join(packageRoot, "node_modules"), { recursive: true });
cpSync(wsSource, path.join(packageRoot, "node_modules", "ws"), {
  recursive: true,
  filter: (sourcePath) => !path.basename(sourcePath).startsWith(".")
});
normalizePermissions(packageRoot);
execFileSync("tar", ["--no-xattrs", "-czf", archive, "-C", dist, packageName], {
  env: {
    ...process.env,
    COPYFILE_DISABLE: "1"
  },
  stdio: "inherit"
});

console.log(`Created ${archive}`);
