export const packageName = "pingfangplayer-player";
export const expectedDependencyVersions = {
  artplayer: "5.4.0",
  "hls.js": "1.6.16"
};
export const packageFiles = [
  {
    source: "maccms-player/static/player/artplayer.html",
    destination: "static/player/artplayer.html"
  },
  {
    source: "node_modules/artplayer/dist/artplayer.js",
    destination: "static/player/artplayer/artplayer-5.4.0.min.js"
  },
  {
    source: "node_modules/hls.js/dist/hls.min.js",
    destination: "static/player/artplayer/hls-1.6.16.min.js"
  },
  {
    source: "maccms-player/static/player/artplayer/pingfang-player-1.0.0.js",
    destination: "static/player/artplayer/pingfang-player-1.0.0.js"
  },
  {
    source: "maccms-player/static/player/artplayer/pingfang-player-1.0.0.css",
    destination: "static/player/artplayer/pingfang-player-1.0.0.css"
  }
];
