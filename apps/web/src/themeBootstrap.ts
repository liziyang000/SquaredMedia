declare global {
  interface Window {
    pingfangLoadThemeStyles: (theme: string) => Promise<unknown>;
  }
}

export const themeBootstrapScript = `(function () {
  var pending = {};
  window.pingfangLoadThemeStyles = function (theme) {
    var names = theme === "default" ? [] : theme === "ink-wash" ? ["ink-wash"] : ["themes-foundation", "themes"];
    return Promise.all(names.map(function (name) {
      var id = "pf-theme-" + name;
      var existing = document.getElementById(id);
      if (existing && existing.sheet) return Promise.resolve();
      if (pending[id]) return pending[id];
      var link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "/template/pingfangvideo/css/" + name + ".css?v=${process.env.NEXT_PUBLIC_THEME_ASSET_VERSION || "dev"}";
      link.setAttribute("blocking", "render");
      pending[id] = new Promise(function (resolve, reject) {
        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", function () {
          link.remove();
          delete pending[id];
          reject(new Error("Theme stylesheet failed: " + name));
        }, { once: true });
        document.head.insertBefore(link, document.querySelector('link[data-precedence="next"]'));
      });
      return pending[id];
    }));
  };
  try {
    var theme = window.localStorage.getItem("pingfang_theme");
    if (["blue-pink-purple", "poster-magazine", "dunhuang-caisson", "digital-particles", "pixel-frog", "ink-wash"].indexOf(theme) !== -1) {
      document.documentElement.setAttribute("data-theme", theme);
      window.pingfangLoadThemeStyles(theme).catch(function () {});
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch (error) {}
})();`;
