import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const archive = path.join(root, "dist", "pingfanggames-server.tar.gz");
const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const requiredEntries = [
  "pingfanggames-server/index.mjs",
  "pingfanggames-server/package.json",
  "pingfanggames-server/README.md",
  "pingfanggames-server/src/game-service.mjs",
  "pingfanggames-server/src/server.mjs",
  "pingfanggames-server/src/ticket.mjs",
  "pingfanggames-server/deploy/pingfanggames.service.example",
  "pingfanggames-server/deploy/nginx-game-socket.conf.example",
  "pingfanggames-server/node_modules/ws/LICENSE",
  "pingfanggames-server/node_modules/ws/package.json",
  "pingfanggames-server/node_modules/ws/wrapper.mjs"
];

for (const entry of requiredEntries) {
  assert.ok(entries.includes(entry), `${entry} should be present in the game server archive`);
}
assert.ok(
  entries.every((entry) => !/(^|\/)\.(?!\.?\/)/.test(entry)),
  "Game server archive must not contain hidden files"
);
assert.ok(
  entries.every((entry) => !/\.env(?:\.|$)/.test(entry)),
  "Game server archive must not contain environment files"
);

const packageJson = JSON.parse(
  execFileSync("tar", ["-xOf", archive, "pingfanggames-server/package.json"], {
    encoding: "utf8"
  })
);
assert.equal(packageJson.dependencies.ws, "8.21.1");
const packagedWs = JSON.parse(
  execFileSync("tar", ["-xOf", archive, "pingfanggames-server/node_modules/ws/package.json"], {
    encoding: "utf8"
  })
);
assert.equal(packagedWs.version, "8.21.1");

const sourceFiles = ["index.mjs", "src/game-service.mjs", "src/server.mjs", "src/ticket.mjs"];
for (const sourceFile of sourceFiles) {
  const source = execFileSync("tar", ["-xOf", archive, `pingfanggames-server/${sourceFile}`], {
    encoding: "utf8"
  });
  assert.doesNotMatch(source, /replace-with-at-least|GAME_TICKET_SECRET\s*=/);
}

assert.match(readFileSync(path.join(root, "services/game-server/README.md"), "utf8"), /房间仅保存在进程内存中/);
console.log("Game server release verification passed");
