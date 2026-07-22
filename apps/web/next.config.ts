import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const localMacCmsOrigin = process.env.MACCMS_ORIGIN?.replace(/\/$/, "") || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8084" : "");
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const lowMemoryBuild = process.env.SQUAREDMEDIA_LOW_MEMORY_BUILD === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repositoryRoot,
  experimental: lowMemoryBuild ? { cpus: 1 } : undefined,
  async rewrites() {
    if (!localMacCmsOrigin) return [];

    return [
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
