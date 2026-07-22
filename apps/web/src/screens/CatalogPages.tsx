"use client";

import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "../app/routing";

import type { ContentData, ContentQuery, ContentSort } from "../api/content";
import { ContentBoundary } from "../components/ContentBoundary";
import { Artwork, EmptyState, PageHeader, Pagination, VodCard } from "../components/PagePrimitives";

const letterOptions = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0~9"];
const sortOptions: Array<{ value: ContentSort; label: string }> = [
  { value: "latest", label: "最新" },
  { value: "hot", label: "最热" },
  { value: "score", label: "评分" }
];

function documentTitle(title: string, siteName: string) {
  return `${title} · ${siteName}`;
}

function stringParam(params: URLSearchParams, name: string) {
  return params.get(name)?.trim() ?? "";
}

function sortParam(params: URLSearchParams): ContentSort {
  const value = stringParam(params, "sort");
  return value === "hot" || value === "score" ? value : "latest";
}

function pageParam(params: URLSearchParams) {
  return Math.max(Number.parseInt(stringParam(params, "page"), 10) || 1, 1);
}

function catalogQuery(typeId: string | undefined, params: URLSearchParams): ContentQuery {
  const requestedTypeId = typeId ?? stringParam(params, "typeId");
  return {
    ...(requestedTypeId && /^\d+$/.test(requestedTypeId) ? { typeId: requestedTypeId } : {}),
    ...(typeId === undefined ? { scope: "library" } : {}),
    area: stringParam(params, "area"),
    year: stringParam(params, "year"),
    class: stringParam(params, "class"),
    lang: stringParam(params, "lang"),
    letter: stringParam(params, "letter"),
    sort: sortParam(params),
    page: pageParam(params),
    pageSize: 24,
    includeFacets: true
  };
}

function hrefWithParams(pathname: string, current: URLSearchParams, changes: Record<string, string | number | undefined>) {
  const params = new URLSearchParams(current);
  Object.entries(changes).forEach(([name, value]) => {
    if (value === undefined || value === "") params.delete(name);
    else params.set(name, String(value));
  });
  if (!("page" in changes)) params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function FilterRow({
  label,
  options,
  active,
  pathname,
  params,
  name,
  includeAll = true
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  active: string;
  pathname: string;
  params: URLSearchParams;
  name: string;
  includeAll?: boolean;
}) {
  return (
    <div className="filter-row">
      <strong>{label}</strong>
      <div className={`filter-options${name === "letter" ? " letter-options" : ""}`}>
        {includeAll && (
          <Link className={!active ? "is-active" : undefined} to={hrefWithParams(pathname, params, { [name]: undefined })}>
            全部
          </Link>
        )}
        {options.map((option) => (
          <Link
            className={option.value === active ? "is-active" : undefined}
            key={option.value}
            to={hrefWithParams(pathname, params, { [name]: option.value })}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function CategoryTypeRow({ content, params }: { content: ContentData; params: URLSearchParams }) {
  const { current, parent, children } = content.categoryContext;
  if (!current) return null;

  const root = parent ?? current;
  const allActive = !parent && !["area", "year", "lang", "letter", "class"].some((name) => stringParam(params, name));
  const categoryHref = (id: string) => hrefWithParams(`/category/${id}`, params, { typeId: undefined });

  return (
    <div className="filter-row">
      <strong>类型</strong>
      <div className="filter-options">
        <Link className={allActive ? "is-active" : undefined} to={categoryHref(root.id)}>
          全部
        </Link>
        {children.map((category) => (
          <Link className={category.id === current.id ? "is-active" : undefined} key={category.id} to={categoryHref(category.id)}>
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SearchTypeRow({ content, params }: { content: ContentData; params: URLSearchParams }) {
  const { current, parent, children } = content.categoryContext;
  if (!current) return null;

  const root = parent ?? current;
  const searchHref = (typeId: string) => hrefWithParams("/search", params, { typeId, class: undefined });

  return (
    <div className="filter-row">
      <strong>类型</strong>
      <div className="filter-options">
        <Link className={!parent ? "is-active" : undefined} to={searchHref(root.id)}>
          全部
        </Link>
        {children.map((category) => (
          <Link className={category.id === current.id ? "is-active" : undefined} key={category.id} to={searchHref(category.id)}>
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function CategoryIndex({ categories }: { categories: ContentData["categories"] }) {
  return (
    <section className="wrap category-index" aria-label="视频分类">
      {categories.map((category) => (
        <article className="category-tile" key={category.id}>
          <Link className="category-hit" to={`/category/${category.id}`} aria-label={`进入${category.name}`} />
          <div className="category-main">
            <span>{category.name}</span>
            <em>进入频道</em>
          </div>
          <div className="category-children">
            {sortOptions.map((option) => (
              <Link className={`category-sort sort-${option.value}`} key={option.value} to={`/category/${category.id}?sort=${option.value}`}>
                {option.label}
              </Link>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function CatalogContent({ content, typeId, params }: { content: ContentData; typeId?: string; params: URLSearchParams }) {
  const category = typeId ? content.categoryContext.current : undefined;
  const pathname = category ? `/category/${category.id}` : "/videos";
  const selectedClass = stringParam(params, "class");
  const query = catalogQuery(typeId, params);
  const result = {
    items: content.videos,
    total: content.total,
    page: content.page,
    totalPages: content.totalPages
  };
  const classes = content.facets.classes;
  const title = category?.name ?? "影片库";
  const sortLabel = sortOptions.find((option) => option.value === query.sort)?.label ?? "最新";

  useEffect(() => {
    document.title = documentTitle(title, content.siteName);
  }, [content.siteName, title]);

  if (typeId && !category) {
    return (
      <main id="mainContent" tabIndex={-1}>
        <section className="wrap system-page">
          <div className="system-box" role="alert">
            <span className="eyebrow">404</span>
            <h1>分类不存在</h1>
            <p>没有找到编号为 {typeId} 的影片分类。</p>
            <Link className="primary-btn" to="/categories">
              浏览全部分类
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="mainContent" tabIndex={-1}>
      <PageHeader eyebrow="分类浏览" title={title} description={`按${sortLabel}排序，共 ${result.total} 部内容。`} />
      {!typeId && <CategoryIndex categories={content.categories} />}
      <section className="wrap filter-panel category-filter">
        <div className="filter-row filter-search-row">
          <strong>搜索</strong>
          <form className="channel-search" action="/search" method="get" role="search">
            {category && <input type="hidden" name="typeId" value={category.id} />}
            <label className="sr-only" htmlFor="reactCategorySearch">
              在{title}中搜索
            </label>
            <input id="reactCategorySearch" type="search" name="wd" placeholder={`在${title}中搜索…`} autoComplete="off" required />
            <button type="submit">搜索</button>
          </form>
        </div>
        {category ? (
          <CategoryTypeRow content={content} params={params} />
        ) : (
          <FilterRow
            label="类型"
            name="typeId"
            active={stringParam(params, "typeId")}
            pathname={pathname}
            params={params}
            options={content.categories.map((item) => ({ value: item.id, label: item.name }))}
          />
        )}
        <FilterRow
          label="地区"
          name="area"
          active={query.area ?? ""}
          pathname={pathname}
          params={params}
          options={content.facets.areas.map((value) => ({ value, label: value }))}
        />
        <FilterRow
          label="年份"
          name="year"
          active={query.year ?? ""}
          pathname={pathname}
          params={params}
          options={content.facets.years.map((value) => ({ value, label: value }))}
        />
        {classes.length > 0 && (
          <FilterRow
            label="剧情"
            name="class"
            active={selectedClass}
            pathname={pathname}
            params={params}
            options={classes.map((value) => ({ value, label: value }))}
          />
        )}
        <FilterRow
          label="语言"
          name="lang"
          active={query.lang ?? ""}
          pathname={pathname}
          params={params}
          options={content.facets.langs.map((value) => ({ value, label: value }))}
        />
        <FilterRow
          label="字母"
          name="letter"
          active={query.letter ?? ""}
          pathname={pathname}
          params={params}
          options={letterOptions.map((value) => ({ value, label: value }))}
        />
        <FilterRow label="排序" name="sort" active={query.sort ?? "latest"} pathname={pathname} params={params} options={sortOptions} includeAll={false} />
        <div className="filter-actions">
          <Link className="filter-reset" to={pathname}>
            重置筛选
          </Link>
        </div>
      </section>
      <section className="wrap content-section">
        <div className={`vod-grid${result.items.length === 0 ? " is-empty" : ""}`}>
          {result.items.map((video) => (
            <VodCard key={video.id} video={video} />
          ))}
          {result.items.length === 0 && (
            <EmptyState title="暂无符合条件的影片" description="试试清除筛选条件，或浏览其他频道。" actionHref={pathname} actionLabel="重置筛选" />
          )}
        </div>
        <Pagination page={result.page} totalPages={result.totalPages} buildHref={(page) => hrefWithParams(pathname, params, { page })} />
      </section>
    </main>
  );
}

export function CatalogPage() {
  const { typeId } = useParams();
  const [params] = useSearchParams();
  return (
    <ContentBoundary request={catalogQuery(typeId, params)}>
      {(content) => <CatalogContent content={content} typeId={typeId} params={params} />}
    </ContentBoundary>
  );
}

export function CategoriesPage() {
  const [params] = useSearchParams();
  const page = pageParam(params);

  return (
    <ContentBoundary request={{ pageSize: 1, includeCategoryTotals: true }}>
      {(content) => {
        const pageSize = 12;
        const totalPages = Math.ceil(content.categories.length / pageSize);
        const normalizedPage = Math.min(page, Math.max(totalPages, 1));
        const categories = content.categories.slice((normalizedPage - 1) * pageSize, normalizedPage * pageSize);
        document.title = documentTitle("视频分类", content.siteName);

        return (
          <main id="mainContent" tabIndex={-1}>
            <PageHeader eyebrow="视频" title="视频分类" description="从这里进入当前站点的全部视频分类。" />
            <section className="wrap category-index">
              {categories.map((category) => {
                return (
                  <article className="category-tile" key={category.id}>
                    <Link className="category-hit" to={`/category/${category.id}`} aria-label={`进入${category.name}`} />
                    <div className="category-main">
                      <span>{category.name}</span>
                      <em>{category.total ?? 0} 部</em>
                    </div>
                    <div className="category-children">
                      {sortOptions.map((option) => (
                        <Link className={`category-sort sort-${option.value}`} key={option.value} to={`/category/${category.id}?sort=${option.value}`}>
                          {option.label}
                        </Link>
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>
            <Pagination page={normalizedPage} totalPages={totalPages} buildHref={(nextPage) => `/categories?page=${nextPage}`} />
          </main>
        );
      }}
    </ContentBoundary>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const keyword = stringParam(params, "wd");
  const typeId = stringParam(params, "typeId") || stringParam(params, "type");
  const searchParams = new URLSearchParams(params);
  searchParams.delete("type");
  searchParams.delete("class");
  const request: ContentQuery = {
    keyword,
    ...(typeId && /^\d+$/.test(typeId) ? { typeId } : {}),
    page: pageParam(params),
    pageSize: 20
  };

  return (
    <ContentBoundary request={request}>
      {(content) => {
        const result = {
          items: content.videos,
          total: content.total,
          page: content.page,
          totalPages: content.totalPages
        };
        const selectedCategory = content.categoryContext.current;
        const selectedChannelId = content.categoryContext.parent?.id ?? selectedCategory?.id ?? typeId;
        document.title = documentTitle(keyword ? `搜索：${keyword}` : "搜索", content.siteName);

        return (
          <main id="mainContent" tabIndex={-1}>
            <PageHeader
              eyebrow="搜索结果"
              title={keyword || "请输入关键词"}
              description={keyword ? `找到 ${result.total} 条相关内容。` : "搜索词不能为空，请输入影片、演员或导演名称。"}
            />
            <section className="wrap filter-panel category-filter search-filter-panel">
              <FilterRow
                label="频道"
                name="typeId"
                active={selectedChannelId}
                pathname="/search"
                params={searchParams}
                options={content.categories.map((category) => ({ value: category.id, label: category.name }))}
              />
              {selectedCategory && <SearchTypeRow content={content} params={searchParams} />}
            </section>
            <section className="wrap content-section">
              {selectedCategory && (
                <div className="section-head compact">
                  <h2>{selectedCategory.name}</h2>
                  <span>搜索结果</span>
                </div>
              )}
              <div className={`vod-list${result.items.length === 0 ? " is-empty" : ""}`}>
                {result.items.map((video) => (
                  <Link className="list-item" key={video.id} to={`/vod/${video.id}`}>
                    <Artwork containerClassName="poster" src={video.poster} alt={video.title} loading="lazy" />
                    <span>
                      <strong>{video.title}</strong>
                      <small>{video.actor || "演员信息待补充"}</small>
                      <span className="card-meta">
                        <span>{video.typeName}</span>
                        <span>{video.year}</span>
                        <span>{video.score.toFixed(1)} 分</span>
                      </span>
                      <em>{video.summary}</em>
                    </span>
                  </Link>
                ))}
                {result.items.length === 0 && (
                  <EmptyState
                    title={keyword ? "没有找到相关影片" : "等待搜索关键词"}
                    description={keyword ? "换个关键词或清除频道筛选后再试。" : "请使用页面顶部搜索框输入影片、演员或导演名称。"}
                  />
                )}
              </div>
              <Pagination page={result.page} totalPages={result.totalPages} buildHref={(page) => hrefWithParams("/search", searchParams, { page })} />
            </section>
          </main>
        );
      }}
    </ContentBoundary>
  );
}

export function RankingsPage() {
  const [params] = useSearchParams();
  const year = String(new Date().getFullYear());
  return (
    <ContentBoundary request={{ scope: "yearly", year, sort: "hot", page: pageParam(params), pageSize: 24 }}>
      {(content) => {
        document.title = documentTitle("年度热度榜", content.siteName);

        return (
          <main id="mainContent" tabIndex={-1}>
            <PageHeader eyebrow="TOP" title="年度热度榜" description={`${year || "当前"} 年按播放热度排序。`} />
            <section className="wrap content-section">
              <div className={`vod-grid${content.videos.length === 0 ? " is-empty" : ""}`}>
                {content.videos.map((video) => (
                  <VodCard key={video.id} video={video} />
                ))}
                {content.videos.length === 0 && <EmptyState title="暂无上榜内容" description="新内容产生热度后会显示在这里。" />}
              </div>
              <Pagination page={content.page} totalPages={content.totalPages} buildHref={(page) => hrefWithParams("/rankings/yearly", params, { page })} />
            </section>
          </main>
        );
      }}
    </ContentBoundary>
  );
}
