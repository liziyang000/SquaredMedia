import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["template/pingfangvideo/js/*.min.js"]
  },
  {
    files: ["template/pingfangvideo/js/*.js", "maccms-player/static/player/artplayer/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.browser
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { caughtErrors: "none" }]
    }
  },
  {
    files: ["template/pingfangvideo/js/qixi-particle-rose.js"],
    languageOptions: {
      sourceType: "module"
    }
  },
  {
    files: ["services/game-server/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { caughtErrors: "none" }]
    }
  }
];
