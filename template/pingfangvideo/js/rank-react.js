(function (window, document) {
  "use strict";

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  if (!React || !ReactDOM || !ReactDOM.createRoot) return;

  var createElement = React.createElement;

  function toArray(list) {
    return Array.prototype.slice.call(list || []);
  }

  function readText(node, selector) {
    var target = node.querySelector(selector);
    return target ? target.textContent.trim() : "";
  }

  function readItem(node, index) {
    var image = node.querySelector("img");
    return {
      href: node.getAttribute("href") || "#",
      title: node.getAttribute("data-rank-title") || readText(node, "strong"),
      meta: node.getAttribute("data-rank-meta") || readText(node, ".rank-meta"),
      score: node.getAttribute("data-rank-score") || readText(node, ".rank-score"),
      pic: node.getAttribute("data-rank-pic") || (image ? image.getAttribute("src") : ""),
      rank: index + 1
    };
  }

  function readItems(root) {
    var source = root.querySelector("[data-rank-react-list]") || root;
    return toArray(source.querySelectorAll("[data-rank-item]"))
      .map(readItem)
      .filter(function (item) {
        return item.title && item.href;
      });
  }

  function RankItem(props) {
    var item = props.item;
    var position = props.position + 1;
    return createElement(
      "a",
      {
        className: "rank-item",
        href: item.href,
        "data-rank-item": "true",
        "data-rank-title": item.title,
        "data-rank-meta": item.meta,
        "data-rank-score": item.score,
        "data-rank-pic": item.pic
      },
      createElement(
        "span",
        { className: "rank-thumb" },
        item.pic
          ? createElement("img", {
              src: item.pic,
              alt: item.title,
              width: "112",
              height: "84",
              loading: "lazy",
              decoding: "async",
              sizes: "72px"
            })
          : null,
        createElement("span", { className: "rank-index" }, position)
      ),
      createElement(
        "span",
        { className: "rank-body" },
        createElement("strong", null, item.title),
        createElement("em", { className: "rank-meta" }, item.meta)
      ),
      createElement("span", { className: "rank-score" }, item.score)
    );
  }

  function RankPanel(props) {
    return createElement(
      React.Fragment,
      null,
      createElement(
        "div",
        { className: "section-head compact" },
        createElement("h2", null, props.title),
        createElement("a", { className: "rank-refresh", href: props.moreUrl || "#" }, "查看更多")
      ),
      createElement(
        "div",
        { className: "rank-list", "data-rank-react-list": "true" },
        props.initialItems.map(function (item, index) {
          return createElement(RankItem, {
            key: item.href + "-" + item.title,
            item: item,
            position: index
          });
        })
      )
    );
  }

  function mount(root) {
    if (!root || root.__pingfangRankRoot) return;
    var items = readItems(root);
    if (!items.length) return;
    var title = readText(root, ".section-head h2") || root.getAttribute("data-rank-title") || "热搜榜";
    var moreUrl = root.getAttribute("data-rank-more-url") || "#";
    root.__pingfangRankRoot = ReactDOM.createRoot(root);
    root.__pingfangRankRoot.render(createElement(RankPanel, {
      initialItems: items,
      title: title,
      moreUrl: moreUrl
    }));
    root.setAttribute("data-rank-react-mounted", "true");
  }

  function mountAll(scope) {
    toArray((scope || document).querySelectorAll("[data-rank-react-root]")).forEach(mount);
  }

  window.PingFangRankReact = {
    mountAll: mountAll
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      mountAll(document);
    });
  } else {
    mountAll(document);
  }
})(window, document);
