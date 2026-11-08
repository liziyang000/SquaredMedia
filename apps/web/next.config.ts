import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { bambooCicadaOfficialUrl } from "./src/gameLinks";

const localMacCmsOrigin = process.env.MACCMS_ORIGIN?.replace(/\/$/, "") || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8084" : "");
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const lowMemoryBuild = process.env.SQUAREDMEDIA_LOW_MEMORY_BUILD === "1";
const themeAssetVersion = createHash("sha256")
  .update(
    ["themes-foundation", "themes", "ink-wash"]
      .map((name) => readFileSync(new URL(`../../template/pingfangvideo/css/${name}.css`, import.meta.url), "utf8"))
      .join("\n")
  )
  .digest("hex")
  .slice(0, 12);

const nextConfig: NextConfig = {
  output: "standalone",
  env: { NEXT_PUBLIC_THEME_ASSET_VERSION: themeAssetVersion },
  outputFileTracingRoot: repositoryRoot,
  experimental: lowMemoryBuild ? { cpus: 1 } : undefined,
  async redirects() {
    return [
      {
        source: "/games/bamboo-cicada",
        destination: bambooCicadaOfficialUrl,
        permanent: true
      }
    ];
  },
  async rewrites() {
    if (!localMacCmsOrigin) return [];

    return [
      {
        source: "/react-runtime/multiplayer-games.js",
        destination: `${localMacCmsOrigin}/template/pingfangvideo/js/multiplayer-games.js`
      },
      { source: "/react-api.php", destination: `${localMacCmsOrigin}/server/react-api.php` },
      { source: "/index.php", destination: `${localMacCmsOrigin}/server/index.php` },
      { source: "/index.php/:path*", destination: `${localMacCmsOrigin}/server/index.php/:path*` },
      { source: "/api.php", destination: `${localMacCmsOrigin}/api.php` },
      { source: "/api.php/:path*", destination: `${localMacCmsOrigin}/api.php/:path*` },
      { source: "/preview/:path*", destination: `${localMacCmsOrigin}/preview/:path*` },
      { source: "/static/:path*", destination: `${localMacCmsOrigin}/static/:path*` },
      { source: "/template/:path*", destination: `${localMacCmsOrigin}/template/:path*` },
      { source: "/upload/:path*", destination: `${localMacCmsOrigin}/upload/:path*` }
    ];
  }
};

export default nextConfig;
