# React 前台性能与加载优化实施计划

> **状态（2026-07-30）：** Next.js Bundle Analyzer、Lighthouse CI 和两轮
> React 优化已实施。React confetti 已按需加载，`ContentBoundary` 的 GSAP
> 阻塞转场及依赖已移除；根级 CSR bailout 已解除并加入构建产物门禁，完成本地
> B0/B1/B2 对比。session 首屏屏障和公开正文 SSR 仍未解决；当前工作区包含
> 未提交修改，后续执行必须继续保护并隔离这些现有改动。

**目标：** 优先修复公共页面首屏退化为纯客户端渲染、会话初始化阻塞公共内容、
全局脚本提前加载和路由包过大问题；在不破坏登录、CSRF、播放授权、线路切换、
游戏门禁和 MacCMS 回退能力的前提下，缩短首屏时间并建立可持续的性能门禁。

**推荐顺序：** 建立可复现基线 → 修复全局 CSR bailout → 安全解开会话与公共内容
的视觉阻塞 → 缩小路由客户端包 → 按需加载特效和播放器 → 优化图片 → 建立 CI
预算和 staging 验收。

---

## 当前证据

### 1. 公共页面的全局 CSR bailout 已解除

- B1 构建的 21 个 HTML 中有 20 个包含
  `BAILOUT_TO_CLIENT_SIDE_RENDERING`；根布局的大范围 `Suspense` 使
  `index.html`、`videos.html` 等页面只输出“正在加载页面”。
- B2 已从根布局移除全页 `Suspense`，根 `RoutingProvider` 不再调用
  `useSearchParams()`。
- 查询参数改由 `AppShell` 在 session ready 后，通过最小局部 `Suspense` 中的
  `SearchParamsProvider` 读取。它仍使用 Next 官方 Hook，因此 query-only、
  前进/后退和跨路由更新继续由 App Router 原子提交，没有自建 History Store。
- B2 构建的 21 个 HTML 中 bailout 标记为 0；19 个常规静态路由直接包含
  `.react-app`、`.site-header` 和“正在确认登录状态”。

这完成了 P0 的静态壳阶段，但还没有完成公开正文 SSR。`AppShell` 仍会在
session pending 时隐藏 page children，因此禁用 JavaScript 时只能看到 Header
和 session 状态，不能看到影片标题、卡片或详情正文。

### 2. 会话初始化形成串行瀑布

- `apps/web/src/app/AccountContext.tsx` 在根级请求 session。
- `apps/web/src/app/AppShell.tsx` 只有在 session 完成后才启用
  `home/navigation` 查询，并在 session pending 时隐藏页面 children。
- 当前冷启动链路近似为：

```text
HTML / hydration
  -> session
  -> home 或 navigation
  -> 页面内容
```

历史回归提示，直接并发请求可能让首次访问生成两个 PHP Session，进而导致登录
CSRF 403。因此不能简单删除 `enabled: !account.isPending`；必须在“公共内容提前
显示”和“单 Session 初始化”之间重新设计安全边界，并重新执行干净浏览器登录回归。

### 3. 首轮优化前的近似加载体积

现有 `.next` 构建并非正式 B0，仅用于判断方向：

| 路由           | 现代 JS gzip | CSS gzip | 说明                            |
| -------------- | -----------: | -------: | ------------------------------- |
| 首页           |    约 244 KB | 约 44 KB | 加 HTML 和 confetti 后约 295 KB |
| 分类/搜索/榜单 |    约 271 KB | 约 44 KB | 加 HTML 和 confetti 后约 321 KB |
| 账号页         |    约 245 KB | 约 44 KB | 账号 API 和校验逻辑进入客户端包 |

额外按需块：

- hls.js：约 157 KB gzip。
- ArtPlayer：约 36 KB gzip。
- GSAP 路由块：约 28.8 KB gzip，本轮已从 React 构建移除。
- canvas-confetti：约 4.4 KB gzip；本轮已从 React 默认页面移除，MacCMS
  按需化仍待后续单独同步。

### 4. 其他明确机会

- `apps/web/src/styles/index.css` 全局导入约 270 KB raw 的旧主题 CSS。
- `apps/web/src/components/ContentBoundary.tsx` 顶层导入 GSAP，并在数据就绪后
  继续等待转场结束才挂载内容；本轮已移除该阻塞链路。
- `apps/web/src/components/MacCmsPlayer.tsx` 用 `Promise.all()` 同时加载
  ArtPlayer 和 hls.js，之后才判断 MP4、原生 HLS 或不支持 HLS 的路径。
- `apps/web/src/app/layout.tsx` 使用 `beforeInteractive` 全局加载 confetti，
  但它只在用户切换到 `pixel-frog` 时需要；React 入口本轮已改为按需加载。
- 通用 `Artwork` 传入了 `sizes`，但原生 `<img>` 不产生响应式 `srcset`。
- React Hero 同时为多个 slide 绑定背景 URL，图片传输可能比脚本更影响 LCP。

---

## 范围

### 包含

- `apps/web` 的首屏渲染、路由边界、公开数据读取、会话启动、客户端包和 CSS。
- React 图片加载、Hero、通用海报组件和图片失败回退。
- React 播放器依赖的按能力加载，不改变授权协议和换线策略。
- React 与 MacCMS 共用的 confetti 按需加载。
- bundle、Lighthouse、请求瀑布和 Core Web Vitals 性能门禁。
- 与上述改动直接对应的单元、E2E、构建和模板兼容测试。

### 默认不包含

- 生产部署、灰度切流或数据库变更。
- 未经单独确认的生产 `pingfangapi` 契约变更。
- 大范围拆分 MacCMS `app.js`。
- 未通过真实片源矩阵的 hls.js light 切换。
- 与性能无直接关系的视觉重设计、路由改名或相邻代码重构。

---

## 开源组件决策

### 首期采用

1. **Next.js 内置 Bundle Analyzer**
   - 当前 Next.js 16 已包含 Turbopack 包分析能力，无需新增运行时依赖。
   - 用于按路由追踪客户端/服务端模块和实际 import chain。
   - 文档：<https://nextjs.org/docs/app/guides/package-bundling>

2. **Lighthouse CI**
   - GitHub：<https://github.com/GoogleChrome/lighthouse-ci>
   - 许可证：Apache-2.0。
   - 用于多次采样、资源预算、性能回归和 PR/CI 门禁。

3. **Next Image**
   - GitHub：<https://github.com/vercel/next.js>
   - 许可证：MIT；项目已经安装 Next.js，无新增运行时包。
   - 首先用于通用海报和 Hero，不用于验证码。
   - 必须先盘点真实图片域名并使用严格 `remotePatterns`；来源不可控时保留原生
     `<img>` 或评审同源 loader，不得开放任意远程代理。

4. **canvas-confetti 按需化**
   - GitHub：<https://github.com/catdad/canvas-confetti>
   - 许可证：ISC；继续使用仓库现有 1.9.4。
   - 从全局 `beforeInteractive`/公共 footer 移除，只在用户触发像素主题且未启用
     `prefers-reduced-motion` 时加载一次。
   - React 入口已完成；MacCMS footer、静态 preview 和 PHP preview 必须作为
     同一后续变更一起处理，不能只删除其中一个入口。

### 条件采用

1. **hls.js light build**
   - GitHub：<https://github.com/video-dev/hls.js>
   - 许可证：Apache-2.0；与当前完整包保持同一版本。
   - 预计可进一步减少约 55 KB gzip，但 light build 不包含 alternate audio、
     subtitles、CMCD、EME/DRM 和 Variable Substitution。
   - 只有真实片源和授权矩阵全部通过后才允许替换完整构建。

2. **esbuild**
   - GitHub：<https://github.com/evanw/esbuild>
   - 许可证：MIT。
   - 仅在后续确认扩大到 MacCMS 性能优化时，用于生成 page-scoped IIFE，
     拆分 `template/pingfangvideo/js/app.js`；不进入 React 首期。

### 首期不采用

- **Embla Carousel：** React 当前没有触摸滑动；只有明确新增拖拽需求时才评审，
  不把新增依赖包装成加载优化。
- **Motion：** 替换 GSAP 的迁移成本高于首期收益；简单转场优先使用 CSS 或
  Web Animations。
- **vanilla-lazyload：** 已有原生懒加载，新增库会形成重复机制。
- **Workbox：** 静态资源已有 Nginx 长缓存，Service Worker 可能误缓存登录态、
  播放票据或媒体响应。
- **TanStack Virtual：** 当前没有超长列表的性能证据，不增加 SEO、焦点和布局复杂度。
- **轻量 DOM/jQuery 替代库：** MacCMS 官方 `home.js` 仍依赖 jQuery，无法真正移除。

---

## 成功标准

### 渲染与请求

- 公共路由构建 HTML 不再包含 `BAILOUT_TO_CLIENT_SIDE_RENDERING`。
- 首页、分类、搜索和详情的初始 HTML 包含真实页面标题和核心内容，而非只有加载占位。
- 干净浏览器冷启动最多建立一个 PHP Session。
- 首页最多请求一次 session、一次 `home_v2`；登录用户允许额外一次首页历史请求。
- 首次登录、退出、重新登录均不得出现 CSRF 403。

### 体积预算

正式 B0 建立后，采用“绝对值或相对改善，两者满足其一”的门禁：

- 首页现代 JS + CSS gzip 不高于 245 KB，或至少比 B0 下降 15%。
- 分类/搜索现代 JS + CSS gzip 不高于 270 KB，或至少比 B0 下降 15%。
- 默认主题不请求 canvas-confetti 和像素字体。
- MP4、原生 HLS 和不需要 HLS.js 的浏览器路径不请求 hls.js chunk。
- 播放器 vendor gzip 不高于现有约 192 KB，除非替代方案通过完整播放矩阵。

### 用户体验

- 移动端五次 Lighthouse 中位数：LCP ≤ 2.5s、TBT ≤ 200ms、CLS ≤ 0.1。
- 若具备真实用户性能上报：staging p75 INP ≤ 200ms。
- 数据就绪后立即挂载内容，不再为装饰性转场额外等待约 400ms。
- `prefers-reduced-motion`、键盘操作、焦点管理和图片失败回退保持有效。

### 业务安全

- 登录、Cookie、CSRF、收藏、历史、设备管理保持原行为。
- 普通、VIP、付费、试看、密码、版权和原生接管播放策略不被绕过。
- HLS 恢复、线路切换、播放进度和 native playback bridge 保持可用。
- 未登录用户不会提前加载会员游戏脚本或 iframe。

---

## 实施任务

### Task 1：隔离当前工作区并建立 B0

**涉及：**

- 当前分支和用户现有未提交修改。
- `apps/web/.next`、构建脚本、性能报告目录。
- CI 使用的 Node.js 22.22.0 环境。

- [ ] 保存当前 HEAD、分支、dirty state 和用户修改清单。
- [ ] 在隔离分支或 worktree 中执行 `npm ci`，不复用当前 extraneous 依赖状态。
- [ ] 运行生产构建并保存 Next Bundle Analyzer 输出。
- [ ] 对 `/`、`/videos`、搜索、详情、播放和账号页记录：
  - 初始 HTML。
  - JS/CSS/图片 gzip 体积。
  - 请求数、请求顺序和 API 耗时。
  - 五次移动端 Lighthouse 中位数。
- [ ] 将 B0 写入后续性能报告，所有目标以该基线为准。

**验证：**

- B0 可在相同 Node、依赖和 fixture 下重复。
- 现有 `.next` 只作交叉参考，不作为最终验收数据。

### Task 2：解除全局 CSR bailout

**涉及：**

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/AppProviders.tsx`
- `apps/web/src/app/routing.tsx`
- 各公开路由的 `page.tsx`

- [x] 移除根布局中的全页 `Suspense`。
- [x] 把 `useSearchParams()` 下沉到 session ready 后的最小客户端岛。
- [ ] 在公开路由服务端化时继续用 Page `params/searchParams` 替换迁移兼容层；
      当前 `usePathname()`、`useParams()` 仍保留在全局路由适配器中。
- [ ] 优先使用 Next App Router 原生页面参数，减少全局 Routing Context。
- [ ] 为真正公开的 `navigation/home/catalog/detail` 数据设计服务端读取和
      TanStack Query initial data/hydration。
- [ ] 账号写操作、浏览器存储、主题交互和播放器继续留在 Client Components。
- [x] 添加构建产物回归检查，禁止公共 HTML 再次出现 bailout 标记或退回旧根
      fallback。

**验证：**

- 直接读取构建 HTML 能看到真实 `<h1>` 和内容。
- JavaScript 禁用时至少能看到公开页面核心内容和错误/空状态。
- App Router 深层 URL 刷新、`301`、`410` 和 `404` 行为不变。

### Task 3：安全解除 session 对公共内容的视觉阻塞

**涉及：**

- `apps/web/src/app/AccountContext.tsx`
- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/api/home.ts`
- 必要时单独评审 `addons/pingfangapi`

- [ ] 明确哪些公开 API 不会创建或改变 PHP Session。
- [ ] 公共页面骨架和公开内容不再因 `account.isPending` 被整体替换。
- [ ] 保留账号敏感操作必须等待 session ready 的约束。
- [ ] 优先采用不会创建第二 Session 的服务端公开读取。
- [ ] 如果现有契约无法同时满足单 Session 与公共首屏，再提交独立
      `session + navigation` bootstrap 设计，得到确认后才修改生产插件。
- [ ] 为 session cookie、CSRF token、未登录降级和 401 恢复补充测试。

**验证：**

- 干净浏览器 HAR 中只有一个会话建立过程和一个 `PHPSESSID`。
- 150ms RTT 模拟下不再出现“session 完成后才开始公共内容”的额外瀑布。
- 首访登录、退出后登录和 session 过期恢复均无 CSRF 403。

### Task 4：缩小路由客户端包并移除阻塞动画

**涉及：**

- `apps/web/src/screens/AccountPages.tsx`
- `apps/web/src/screens/ContentPages.tsx`
- `apps/web/src/screens/GamesPages.tsx`
- `apps/web/src/components/ContentBoundary.tsx`
- `apps/web/src/styles/index.css`

- [ ] 按路由拆分大而多出口的 screen 文件，共享纯逻辑保留为小型 helper/hook。
- [ ] 将轻量 session/header 数据与完整账号 API、表单和 Zod schema 分离。
- [x] 移除 `ContentBoundary` 顶层 GSAP import。
- [x] 数据就绪时立即渲染内容；简单 opacity/translate 转场改用非阻塞 CSS 或
      Web Animations。
- [ ] 使用 CSS coverage 将 React 必需的 tokens/core/theme 与旧 MacCMS 页面样式
      分离，禁止一次性重写整份主题 CSS。
- [ ] 每拆一个路由族都记录 bundle delta，收益不成立时停止继续抽象。

**验证：**

- 分类、搜索和榜单初始包不再包含 GSAP chunk。
- Query resolved 后同一渲染周期即可查询到卡片。
- 各路由只包含自己的页面逻辑，账号或游戏实现不进入无关公共页。
- 视觉、响应式和 reduced-motion 回归通过。

### Task 5：按需加载 confetti 与播放器依赖

**涉及：**

- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/SiteHeader.tsx`
- `apps/web/src/components/MacCmsPlayer.tsx`
- `template/pingfangvideo/html/public/foot.html`
- `template/pingfangvideo/js/app.js`

- [x] 移除 React 根布局的 confetti `beforeInteractive`。
- [x] 在首次切换 `pixel-frog` 且允许动效时，以单例 Promise 加载 confetti。
- [ ] MacCMS 主题使用相同的首次触发加载策略。
- [x] 加载失败时只跳过粒子，不影响主题切换。
- [ ] 播放器先判断媒体类型和原生 HLS 能力。
- [ ] 只有 `kind=hls` 且浏览器不能原生播放时才动态 import hls.js。
- [ ] 缓存 import Promise，防止换线或重挂载重复请求同一 chunk。

**验证：**

- 默认主题 HAR 不包含 confetti。
- 首次切换像素主题仅加载一次，reduced-motion 下不播放粒子。
- MP4、WebKit 原生 HLS、Quark 原生接管路径不请求 hls.js。
- Chromium HLS 只加载一次，重试、恢复、换线和销毁行为正常。

### Task 6：试点响应式图片

**涉及：**

- `apps/web/src/components/PagePrimitives.tsx`
- `apps/web/src/screens/HomePage.tsx`
- `apps/web/next.config.ts`
- 图片相关 API DTO 和测试

- [ ] 从真实 staging 数据统计 poster/backdrop 域名和协议。
- [ ] 只为可信域配置精确 `remotePatterns`。
- [ ] 先在通用海报组件试点 Next Image，保留现有缺图状态和尺寸比例。
- [ ] Hero 从多张 CSS background 改为只优先加载当前 LCP 图片，并有限预取下一张。
- [ ] 验证码、一次性动态图片和来源不可信的 URL 保持原生 `<img>`。
- [ ] 对比优化前后的请求数量、源图尺寸、WebP/AVIF 命中、LCP 和 CLS。

**验证：**

- 图片代理不能请求白名单外地址。
- 图片失败时仍显示主题占位，不出现无限重试。
- 首屏不同时下载全部 Hero 大图。
- 图片传输量和 LCP 有可测改善，否则撤销该试点。

### Task 7：评估 hls.js light，不直接切换

**涉及：**

- `apps/web/src/components/MacCmsPlayer.tsx`
- 独立 MacCMS/ArtPlayer 播放入口
- 播放权限和片源验收矩阵

- [ ] 统计线上真实 HLS 是否使用字幕、多音轨、DRM/EME、CMCD、
      Variable Substitution、Live 和特殊封装。
- [ ] 用相同版本的 full/light 构建对一组真实片源做 A/B。
- [ ] 覆盖普通、VIP、付费、试看、密码、版权、主清单、Variant、换线和恢复。
- [ ] 只有全部通过且体积收益达到预期时，才提交单独切换变更。

**验证：**

- 任一功能需要 light build 缺失模块时，继续保留完整 hls.js。
- 不能用“页面 200”或“出现 video 元素”代替真实播放验收。

### Task 8：加入性能门禁

**涉及：**

- `package.json`
- `.github/workflows/ci.yml`
- `lighthouserc.cjs`
- `scripts/create-lighthouse-fixture.php`
- `scripts/start-lighthouse-web.sh`
- `scripts/verify-next-prerender.mjs`
- 新增的 bundle budget 检查脚本

- [x] 增加可重复的 bundle analyze 命令。
- [ ] 从 Next 构建 HTML/manifest 统计代表路由的现代 JS 与 CSS gzip。
- [ ] 将 B0 与预算写入机器可读配置。
- [x] 配置 Lighthouse CI 多次采样，不以单次分数作为硬门禁。
- [x] 对高波动的性能分数和 LCP 先 warning，对 JS/CSS 资源体积使用 error。
- [x] 为全页 bailout 增加稳定的 error 断言。
- [ ] 为无条件请求增加稳定的 error 断言。
- [x] 输出 B0/B1/B2 对比，包含收益、未改善项和业务回归结论。

**已落地（2026-07-30）：**

- `npm run analyze:web` 先使用生产 API 路径重建当前代码，再调用 Next.js 16
  内置 `next experimental-analyze --output`；结果写入
  `apps/web/.next/diagnostics/analyze/`，不会复用旧 `.next`。
- `npm run performance:lighthouse` 使用本地 PHP fixture 构建 production
  前台，并对 `/`、`/videos`、`/vod/1` 各采样 5 次。启动时会生成临时
  performance 数据，把 poster、backdrop 和媒体 URL 固定到仓库内资源；
  当前 15 次报告的请求 Origin 只有 `http://127.0.0.1:5173`。
- CI 新增独立 `performance` job，固定 Node.js 22.22.0，安装 Chromium，
  失败或成功均上传 `output/lighthouse/` 报告。
- Lighthouse 使用中位数聚合；performance score、LCP、TBT、CLS 先作为
  warning，JS 330 KB 和 CSS 65 KB 作为 error 预算。
- 本机完整 15 次基线（Node.js 26.0.0、PHP 8.4.22）如下，仅证明工具链和
  本地 fixture，可用于发现方向，不能替代 Node.js 22.22.0 CI 或 staging B0：
  采用 `2026-07-30T07:59:30Z` 至 `08:02:07Z` 的报告。更早的
  `07:43:58Z` 至 `07:48:21Z` 批次仍请求 `picsum.photos`，不作为本地固定资产
  B0。

| 路由      | Performance 中位数 | LCP 中位数 | TBT 中位数 | CLS 中位数 | JS 传输 | CSS 传输 |
| --------- | -----------------: | ---------: | ---------: | ---------: | ------: | -------: |
| `/`       |               0.84 |     4.37 s |      21 ms |          0 |  286 KB |    45 KB |
| `/videos` |               0.85 |     4.31 s |      15 ms |          0 |  286 KB |    45 KB |
| `/vod/1`  |               0.86 |     3.93 s |       4 ms |          0 |  307 KB |    46 KB |

### 首轮 B1：React 按需脚本与非阻塞内容

本轮只落地不改变账号、权限和播放协议的优化：

- 根布局不再输出 confetti preload/`beforeInteractive` script。
- `SiteHeader` 仅在用户显式选择 `pixel-frog` 且允许动效时加载仓库内现有
  confetti 文件；加载使用单例 Promise、失败清理和选择 revision 校验，避免
  重复插入、切换主题后的迟到回调和卸载后创建 canvas。
- `ContentBoundary` 在 query resolved 后立即挂载内容，不再显示“内容已准备好”
  中间状态或等待 GSAP timeline；不可见 `role="status"` 继续通知辅助技术内容
  已加载完成。
- `@gsap/react` 和 `gsap` 已从 React 应用依赖、根 lockfile、standalone deploy manifest
  及 deploy lockfile 中移除。

同一台本机、同一 production fixture、同一 3 路由 × 5 次配置的中位数对比如下。
B1 使用最终代码生成的 `2026-07-30T08:36:27Z` 至 `08:39:02Z` 报告：

| 路由      | Performance B0 → B1 | LCP B0 → B1     | TBT B0 → B1      | JS B0 → B1                      |
| --------- | ------------------: | --------------- | ---------------- | ------------------------------- |
| `/`       |         0.84 → 0.84 | 4.37 s → 4.52 s | 20.5 ms → 8.5 ms | 285,898 B → 251,228 B（-12.1%） |
| `/videos` |         0.85 → 0.88 | 4.31 s → 3.86 s | 15 ms → 8.5 ms   | 285,898 B → 251,228 B（-12.1%） |
| `/vod/1`  |         0.86 → 0.90 | 3.93 s → 3.64 s | 4 ms → 4 ms      | 307,461 B → 272,756 B（-11.3%） |

三条路由 CLS 仍为 0，CSS 传输量不变。`/videos` 和 `/vod/1` 的 LCP 分别改善
约 0.44 秒和 0.29 秒；首页 LCP 反而波动增加约 0.15 秒，因此不能把本轮描述为
首页 LCP 已改善。三条路由仍未达到 LCP ≤ 2.5 秒目标，warning 保留。

产物检查：

- 20 个常规静态 HTML 中 `canvas-confetti` 命中数由 20 降为 0。
- React client/server 构建中的 GSAP 命中数降为 0。
- 15 份 B1 Lighthouse 报告没有 confetti 请求，且请求 Origin 仍只有
  `http://127.0.0.1:5173`。
- 单元测试和浏览器网络日志确认：非像素主题不插入脚本，点击像素主题后才请求
  同源 confetti。Pixel Frog Playwright 回归确认主题刷新后仍能恢复，会员游戏
  门禁和登录回跳保持通过。

### 第二轮 B2：解除根级 CSR bailout

本轮只收敛查询参数与渲染边界，不改变账号、权限、公开数据或播放请求顺序：

- 根 `RoutingProvider` 不再调用 Next `useSearchParams()`，根布局删除全页
  `Suspense` 和“正在加载页面”fallback。
- `SearchParamsProvider` 只包裹 session ready 后的 page children，并由局部
  `Suspense` 隔离。它直接消费 Next 官方 query 快照，不在导航前乐观改写参数，
  也不 patch `history.pushState/replaceState`。
- `useLocation().state.from` 继续从 query 读取，并复用原有同源路径校验；
  `Navigate` 继续把内存 state 编码为可刷新、可回退的 `from` 参数。
- 新增 `npm run verify:web-prerender`。`build:web`、Analyzer、Lighthouse、
  CI 和本地部署构建都会检查：
  - 所有生成 HTML 不包含 `BAILOUT_TO_CLIENT_SIDE_RENDERING`。
  - 所有常规静态路由包含 `.react-app`、`.site-header` 和 session-first 状态。
  - 静态 DOM 不得恢复旧根 fallback。
- 门禁脚本本身已纳入 Next release input fingerprint；以后只修改门禁规则也会
  使旧 standalone 构建缓存失效，避免缓存命中绕过新规则。

同一台本机、同一 production fixture、同一 3 路由 × 5 次配置的中位数如下。
B2 使用 `2026-07-30T09:13:56Z` 至 `09:16:29Z` 的 15 份报告：

| 路由      | Performance B1 → B2 | LCP B1 → B2     | TBT B1 → B2    | JS B1 → B2            |
| --------- | ------------------: | --------------- | -------------- | --------------------- |
| `/`       |         0.84 → 0.85 | 4.52 s → 4.38 s | 8.5 ms → 14 ms | 251,228 B → 251,296 B |
| `/videos` |         0.88 → 0.88 | 3.86 s → 3.87 s | 8.5 ms → 11 ms | 251,228 B → 251,296 B |
| `/vod/1`  |         0.90 → 0.90 | 3.64 s → 3.62 s | 4 ms → 13 ms   | 272,756 B → 272,824 B |

三条路由 CLS 仍为 0。首页 LCP 改善约 0.14 秒，影片库和详情页基本持平；
TBT 增加但仍远低于 200 ms warning 预算。每条路由脚本传输只增加 68 B，
说明本轮不是依靠增加客户端包换取静态壳。Lighthouse 的 FCP 基本不变，因为
B1 的全页加载占位本身也会被计为首次内容；B2 的主要改善是初始 HTML 从无业务
结构的占位变成可识别的站点 Header 与 session 状态，不能描述为公开正文已
服务端渲染。

### B2 后仍未落地的 P0 结论

- `AppShell` 仍在 session pending 时隐藏 page children。公共页面核心标题、
  卡片和详情正文尚未进入初始 HTML，Task 2 只完成静态壳阶段。
- 不能直接删除 session gate 或把 navigation/home 与 session 并发。生产
  controller 会在所有 action 前执行用户标签/session 逻辑，公开内容也包含
  用户组过滤；历史干净浏览器回归已证明并发可能产生两个 `PHPSESSID` 并触发
  登录 CSRF 403。
- 本地 Lighthouse fixture 对公开 GET 明确不启动 PHP Session，所以 B2 不能
  证明生产 Cookie 屏障安全。下一阶段必须先决定 sessionless guest bootstrap，
  或让服务端 bootstrap 一并转交 Cookie 与 CSRF；任一方案都需要 staging
  干净浏览器验证，不能在本轮前端优化中顺手实施。

**本轮验证：**

- `npm run analyze:web`：通过，production build 后约 1.6～1.8 秒生成
  Analyzer 输出。
- `npm run performance:lighthouse`：通过，15 份报告落盘；体验目标产生
  warning，JS/CSS error 预算全部通过。
- `npm run verify:web-prerender`：通过；21 个 HTML 中 bailout 为 0，
  19 个常规静态路由保留 session-first 静态壳。
- `npm run lint`：通过。
- `npm test`：通过，包括 23 个 Web 测试文件、204 个 Web 用例及仓库中的
  Node/PHP 契约测试。
- `npm run typecheck:web`、production build、Analyzer 和 7 项 Playwright：
  通过；浏览器回归覆盖 query-only 分类筛选、安全状态参数、登录回跳和多人游戏
  房间参数。
- `npm install` 对当前完整依赖树提示 13 项安全告警（2 low、1 moderate、
  10 high）；本轮没有执行破坏性的 `npm audit fix`，后续应单独完成依赖安全
  审查，不能把这些告警直接归因于单一包。

**验证：**

- 新增大依赖导致代表页面超过 JS/CSS 预算时 CI 失败。
- 重新出现全页 CSR bailout 会使 `build:web` 失败；恢复全局 confetti/GSAP
  的专项 error 检查仍待补充。
- 性能门禁不替代现有功能、模板和安全测试。

---

## 完整验证

React 与仓库验证：

```bash
npm test
npm run lint
npm run typecheck:web
npm run test:e2e
npm run build:web
```

涉及 MacCMS 主题文件时必须额外运行：

```bash
npm run lint:template
npm run verify:compat
npm run verify:preview
```

发布前才运行：

```bash
npm run package
npm run verify:release
```

性能验证必须基于生产构建，并额外检查：

- 代表路由的构建 HTML。
- Bundle Analyzer 与路由 gzip 预算。
- 干净浏览器 session/login HAR。
- 默认主题、像素主题、MP4、原生 HLS、非原生 HLS 的请求清单。
- 五次移动端 Lighthouse 中位数。
- staging 真实数据、真实 Cookie 和实际播放矩阵。

---

## 风险与回滚

- **Session 风险：** 不允许以直接并发替代现有串行逻辑；出现双 Session 或 CSRF
  回归时立即回滚该阶段。
- **缓存风险：** 公开数据只有在确认不含用户态和权限差异后才允许共享缓存。
- **图片风险：** 禁止使用开放式远程图片匹配；优化器内存、磁盘缓存和源站压力需要监控。
- **播放风险：** hls.js 按需化与 light build 分成两个独立提交，便于单独回滚。
- **样式风险：** CSS 按 coverage 小步拆分，不做全量重写。
- **工作区风险：** 当前用户修改不得被 reset、checkout 或格式化覆盖。
- **发布风险：** 本文不授权部署；本地通过后仍需 staging B0/B1 和业务验收。

---

## 待确认项

1. 首期是否只优化 React staging，并仅同步 MacCMS 的 confetti 按需加载？
2. 如果单 Session 优化确实需要新增 `pingfangapi` bootstrap，是否允许单独纳入？
3. 真实 poster/backdrop 域名是否稳定，能够建立严格的图片白名单？
4. 是否需要在首期之后继续用 esbuild 拆分 MacCMS `app.js`？
