# Third-party games

The theme vendors the browser runtimes below and keeps their upstream licenses
beside the source:

- `2048/`: [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048),
  commit `478b6ec346e3787f589e4af751378d06ded4cbbc`, MIT License.
- `blockrain/`: [Aerolab/blockrain.js](https://github.com/Aerolab/blockrain.js),
  commit `ba6d4192370d2ce4f75ce31796f345eb5711b489`, MIT License.

The upstream JavaScript runtimes are kept unchanged. PingFang Video supplies
its own MacCMS templates, Chinese copy, theme-aware colors, responsive layout,
and login gating. No upstream standalone HTML entry is shipped, so gameplay is
only rendered by the authenticated `html/label/game-*.html` branches.

`bamboo-cicada.js` is a first-party, dependency-free three-stage rhythm game.
It uses pointer/keyboard input, moving speed targets, timed wind and reversal
events, local score records, and the browser Web Audio API to synthesize its
continuous cicada voice and feedback cues.
The multiplayer Gomoku and Draw & Guess games are also first-party code. Their
browser client lives in `../js/multiplayer-games.js`; their authenticated room
service is packaged separately from `services/game-server/`.

`blockrain/jquery-1.11.1.min.js` is retained only for the repository's local
preview, which does not provide MacCMS core jQuery. The production package
excludes that file and uses the jQuery already loaded by MacCMS.
