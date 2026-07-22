export const homeFixtureResponse = {
  siteName: "平方影视",
  todayUpdated: 8,
  hotSearch: ["科幻大片"],
  categories: ["娱乐新闻", "电影", "剧集", "综艺", "动漫", "纪录"],
  history: [{ videoId: 1, episode: 1, watchedAt: "2026-06-15 18:20", progress: "已看到 48:02" }],
  videos: [
    {
      id: 1,
      title: "云端回声",
      category: "电影",
      remark: "高清",
      actor: "主演 A",
      director: "导演 A",
      year: "2026",
      area: "中国大陆",
      class: "科幻",
      lang: "国语",
      letter: "Y",
      hits: 98120,
      score: 8.8,
      updated: "2026-06-15",
      poster: "https://example.com/poster.jpg",
      backdrop: "https://example.com/backdrop.jpg",
      duration: "2小时08分",
      version: "4K",
      summary: "一段被隐藏的记忆。",
      episodes: [{ no: 1, name: "正片", src: "https://example.com/video.mp4" }]
    }
  ]
};

const homeFixtureVideo = homeFixtureResponse.videos[0];
const homeFixtureCard = {
  id: homeFixtureVideo.id,
  title: homeFixtureVideo.title,
  remark: homeFixtureVideo.remark,
  year: homeFixtureVideo.year,
  class: homeFixtureVideo.class,
  score: homeFixtureVideo.score,
  poster: homeFixtureVideo.poster
};

export const navigationFixtureResponse = {
  siteName: homeFixtureResponse.siteName,
  categories: [
    { id: "42", name: "电影" },
    { id: "47", name: "剧集" },
    { id: "48", name: "综艺" },
    { id: "57", name: "动漫" },
    { id: "111", name: "纪录" }
  ]
};

export const homeV2FixtureResponse = {
  siteName: homeFixtureResponse.siteName,
  todayUpdated: homeFixtureResponse.todayUpdated,
  categories: navigationFixtureResponse.categories,
  hero: [
    {
      id: homeFixtureVideo.id,
      title: homeFixtureVideo.title,
      year: homeFixtureVideo.year,
      class: homeFixtureVideo.class,
      backdrop: homeFixtureVideo.backdrop,
      duration: homeFixtureVideo.duration,
      version: homeFixtureVideo.version,
      summary: homeFixtureVideo.summary,
      episodes: [{ id: 1, sourceId: 1 }]
    }
  ],
  ranking: [homeFixtureCard],
  latest: [homeFixtureCard],
  latestByCategory: [{ categoryId: "42", videos: [homeFixtureCard] }]
};
