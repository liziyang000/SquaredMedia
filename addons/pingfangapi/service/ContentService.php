<?php

namespace addons\pingfangapi\service;

use think\Db;

class ContentService
{
    const CONTENT_CACHE_VERSION = 'v10';
    const DEFAULT_HOME_LIMIT = 120;
    const MAX_HOME_LIMIT = 300;
    const DEFAULT_CACHE_SECONDS = 300;
    const DEFAULT_SUMMARY_CACHE_SECONDS = 1800;
    const MAX_SUMMARY_CACHE_SECONDS = 86400;
    const TODAY_CACHE_SECONDS = 60;
    const DEFAULT_COMMENT_LIMIT = 100;
    const HOME_TYPE_IDS = '42,47,48,57,111';

    private $accessChecker;
    private $blockedTypeIdsLoaded = false;
    private $blockedTypeIdsValue = [];

    public function __construct(callable $accessChecker)
    {
        $this->accessChecker = $accessChecker;
    }

    public function home()
    {
        $limit = $this->configInteger('home_limit', self::DEFAULT_HOME_LIMIT, 24, self::MAX_HOME_LIMIT);
        $cacheSeconds = $this->configInteger('cache_seconds', self::DEFAULT_CACHE_SECONDS, 0, 300);
        $cacheKey = 'pingfangapi_home_' . self::CONTENT_CACHE_VERSION . '_' . $limit . '_' . $this->accessCacheKey();

        if ($cacheSeconds > 0 && function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached) && isset($cached['videos'], $cached['categories'])) {
                return $cached;
            }
        }

        $typeList = $this->typeList();
        $rows = $this->pageRows(['playableOnly' => true], $typeList, 'latest', 1, $limit);
        $videos = $this->mapRows($rows, $typeList);

        $homeVideos = [];
        foreach ($videos as $video) {
            $homeVideos[] = $this->homeVideo($video);
        }

        $home = [
            'siteName' => $this->siteName(),
            'todayUpdated' => $this->todayUpdated($videos),
            'hotSearch' => $this->hotSearch(),
            'categories' => $this->publicCategories($this->categories($typeList)),
            'videos' => $homeVideos,
        ];

        if ($cacheSeconds > 0 && function_exists('cache')) {
            cache($cacheKey, $home, $cacheSeconds);
        }

        return $home;
    }

    public function navigation()
    {
        $typeList = $this->typeList();

        return [
            'siteName' => $this->siteName(),
            'categories' => $this->homeCategories($typeList),
        ];
    }

    public function homeV2($compact = false)
    {
        $compact = (bool) $compact;
        $cacheSeconds = $this->configInteger('cache_seconds', self::DEFAULT_CACHE_SECONDS, 0, 300);
        $cacheKey = 'pingfangapi_home_v2_' . self::CONTENT_CACHE_VERSION . '_' . ($compact ? 'compact' : 'legacy') . '_' . $this->accessCacheKey();
        if ($cacheSeconds > 0 && function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached) && isset($cached['hero'], $cached['ranking'], $cached['latest'], $cached['latestByCategory'])) {
                return $cached;
            }
        }

        $typeList = $this->typeList();
        $categories = $this->homeCategories($typeList);
        $typeIds = implode(',', array_map(function ($category) {
            return (string) $category['id'];
        }, $categories));
        $year = (string) date('Y');
        $hero = [];
        $ranking = [];
        $latest = [];
        $latestByCategory = [];

        if ($typeIds !== '') {
            $hero = $this->homeHeroRows($this->nativeVodRows(
                $typeIds,
                5,
                'hits',
                '',
                $cacheSeconds,
                $this->homeHeroFields(),
                'hero'
            ), $compact);
            $ranking = $this->homeCardRows($this->nativeVodRows(
                $typeIds,
                5,
                'hits',
                $year,
                $cacheSeconds,
                $this->homeCardFields(),
                'ranking'
            ));
            $latest = $this->homeCardRows($this->nativeVodRows(
                $typeIds,
                6,
                'time',
                $year,
                $cacheSeconds,
                $this->homeCardFields(),
                'latest'
            ));
        }
        foreach ($categories as $category) {
            $latestByCategory[] = [
                'categoryId' => (string) $category['id'],
                'videos' => $this->homeCardRows($this->nativeVodRows(
                    (string) $category['id'],
                    6,
                    'time',
                    $year,
                    $cacheSeconds,
                    $this->homeCardFields(),
                    'category-' . (string) $category['id']
                )),
            ];
        }

        $home = [
            'siteName' => $this->siteName(),
            'todayUpdated' => $this->todayUpdated([]),
            'categories' => $categories,
            'hero' => $hero,
            'ranking' => $ranking,
            'latest' => $latest,
            'latestByCategory' => $latestByCategory,
        ];
        if (!$compact) {
            $home = array_slice($home, 0, 2, true)
                + ['hotSearch' => $this->hotSearch()]
                + array_slice($home, 2, null, true);
        }

        if ($cacheSeconds > 0 && function_exists('cache')) {
            cache($cacheKey, $home, $cacheSeconds);
        }

        return $home;
    }

    public function contentPage(array $query)
    {
        $compact = !empty($query['compact']);
        $includeCategoryTotals = !$compact || !empty($query['includeCategoryTotals']);
        $includeFacets = !$compact || !empty($query['includeFacets']);
        $typeList = $this->typeList();
        $categories = $includeCategoryTotals
            ? $this->categories($typeList)
            : $this->catalogCategories($typeList, isset($query['scope']) ? $query['scope'] : '');
        $pageSize = max(1, min(100, intval(isset($query['pageSize']) ? $query['pageSize'] : 24)));
        $requestedPage = max(1, intval(isset($query['page']) ? $query['page'] : 1));
        $total = $includeCategoryTotals ? $this->categoryTotalForQuery($query, $categories) : null;
        if ($total === null) {
            $total = $this->queryTotal($query, $typeList);
        }
        $totalPages = $total > 0 ? intval(ceil($total / $pageSize)) : 0;
        $page = min($requestedPage, max(1, $totalPages));
        $isSearch = array_key_exists('keyword', $query);
        $rows = $this->pageRows(
            $query,
            $typeList,
            isset($query['sort']) ? $query['sort'] : 'latest',
            $page,
            $pageSize,
            0,
            false,
            $compact ? $this->contentCardFields($isSearch) : null
        );
        $videos = $compact
            ? $this->mapContentCardRows($rows, $typeList, $isSearch)
            : $this->mapRows($rows, $typeList, false);
        $typeId = intval(isset($query['typeId']) ? $query['typeId'] : 0);

        $content = [
            'siteName' => $this->siteName(),
            'categories' => $categories,
            'categoryContext' => $this->categoryContext($typeId, $typeList),
            'facets' => [
                'areas' => $includeFacets ? $this->facetOptions('area', $query, $typeList) : [],
                'years' => $includeFacets ? $this->facetOptions('year', $query, $typeList) : [],
                'langs' => $includeFacets ? $this->facetOptions('lang', $query, $typeList) : [],
                'classes' => $includeFacets ? $this->classOptions($query, $typeList) : [],
            ],
            'videos' => $videos,
            'total' => $total,
            'page' => $page,
            'totalPages' => $totalPages,
        ];
        if (!$compact) {
            $content = array_slice($content, 0, 1, true)
                + [
                    'todayUpdated' => $this->todayUpdated($videos),
                    'contentYear' => $this->contentYear($videos),
                    'hotSearch' => $this->hotSearch(),
                ]
                + array_slice($content, 1, 5, true)
                + ['pageSize' => $pageSize]
                + array_slice($content, 6, null, true);
        }
        return $content;
    }

    public function detail($vodId, $compact = false)
    {
        $compact = (bool) $compact;
        $vodId = intval($vodId);
        $row = $this->vodRow($vodId, $this->detailFields($compact));
        if (empty($row)) {
            throw new ApiException(404, '影片不存在');
        }
        $this->assertAccess($row, 2);

        $typeList = $this->typeList();
        $playList = $this->playList($row);
        $video = self::mapVideoRow($row, $typeList, $playList, $this->fallbackImage());
        $video['playSources'] = $this->playSources($playList);
        $video['scoreCount'] = max(0, intval(isset($row['vod_score_num']) ? $row['vod_score_num'] : 0));
        $video['likes'] = max(0, intval(isset($row['vod_up']) ? $row['vod_up'] : 0));
        $video['dislikes'] = max(0, intval(isset($row['vod_down']) ? $row['vod_down'] : 0));

        $relatedRows = $this->pageRows(
            ['typeId' => intval($video['typeId'])],
            $typeList,
            'hot',
            1,
            7,
            $vodId,
            false,
            $compact ? $this->contentCardFields(false) : null
        );
        $related = $compact
            ? array_slice($this->mapContentCardRows($relatedRows, $typeList, false), 0, 6)
            : array_slice($this->mapRows($relatedRows, $typeList, false), 0, 6);

        $responseVideo = $video;
        if ($compact) {
            unset($responseVideo['typeId'], $responseVideo['letter'], $responseVideo['version']);
        }
        return [
            'siteName' => $this->siteName(),
            'video' => $responseVideo,
            'related' => $related,
        ];
    }

    public function playback($vodId, $sourceId, $episodeId)
    {
        $vodId = intval($vodId);
        $sourceId = intval($sourceId);
        $episodeId = intval($episodeId);
        $row = $this->vodRow($vodId, $this->playbackFields(true));
        if (empty($row)) {
            throw new ApiException(404, '播放资源不存在');
        }
        if (intval(isset($row['vod_copyright']) ? $row['vod_copyright'] : 0) === 1
            && intval(isset($GLOBALS['config']['app']['copyright_status']) ? $GLOBALS['config']['app']['copyright_status'] : 0) === 3) {
            throw new ApiException(403, '该内容受版权限制');
        }

        $playList = $this->playList($row);
        if (empty($playList[$sourceId]['urls'][$episodeId])) {
            throw new ApiException(404, '播放资源不存在');
        }
        $this->assertPlaybackAccess($row, $sourceId, $episodeId);

        $episode = $playList[$sourceId]['urls'][$episodeId];
        $episodeName = self::nonEmptyText(
            isset($episode['name']) ? $episode['name'] : (isset($episode['title']) ? $episode['title'] : ''),
            '第' . $episodeId . '集'
        );
        $playerUrl = $this->playerUrl($vodId, $sourceId, $episodeId);

        return [
            'siteName' => $this->siteName(),
            'vodId' => (string) $vodId,
            'sourceId' => (string) $sourceId,
            'episodeId' => (string) $episodeId,
            'title' => self::nonEmptyText(isset($row['vod_name']) ? $row['vod_name'] : '', '未命名影片'),
            'episodeName' => $episodeName,
            'poster' => self::imageUrl(isset($row['vod_pic']) ? $row['vod_pic'] : '', $this->fallbackImage()),
            'playSources' => $this->playSources($playList),
            'kind' => 'iframe',
            'url' => $playerUrl,
        ];
    }

    public function access($vodId, $scope, $sourceId = 0, $episodeId = 0)
    {
        $vodId = intval($vodId);
        $scope = trim((string) $scope);
        $sourceId = intval($sourceId);
        $episodeId = intval($episodeId);
        if (!in_array($scope, ['detail', 'playback', 'download', 'confirm', 'unavailable'], true)) {
            throw new ApiException(422, '访问范围不受支持');
        }

        $withEpisode = $sourceId > 0 || $episodeId > 0;
        $row = $this->vodRow($vodId, $this->gateFields($scope, $withEpisode));
        if (empty($row)) {
            throw new ApiException(404, '影片不存在');
        }

        $this->assertAccessEpisode($row, $scope, $sourceId, $episodeId);

        $state = $this->accessState($row, $scope, $sourceId, $episodeId);
        return [
            'siteName' => $this->siteName(),
            'video' => [
                'id' => (string) $vodId,
                'title' => self::nonEmptyText(isset($row['vod_name']) ? $row['vod_name'] : '', '未命名影片'),
            ],
            'scope' => $scope,
            'state' => $state['state'],
            'authorized' => $state['authorized'],
            'passwordRequired' => $state['passwordRequired'],
            'message' => $state['message'],
            'points' => $state['points'],
            'tryseeMinutes' => $state['tryseeMinutes'],
        ];
    }

    public function downloads($vodId)
    {
        $vodId = intval($vodId);
        $row = $this->vodRow($vodId, $this->downloadFields());
        if (empty($row)) {
            throw new ApiException(404, '影片不存在');
        }

        $list = $this->downloadList($row);
        $firstSourceId = intval(key($list));
        $firstEpisodeId = $firstSourceId > 0 && !empty($list[$firstSourceId]['urls'])
            ? intval(key($list[$firstSourceId]['urls']))
            : 0;
        $state = $this->accessState($row, 'download', $firstSourceId, $firstEpisodeId);
        $sources = [];
        if ($state['authorized'] || $state['state'] === 'password') {
            foreach ($list as $sourceKey => $source) {
                $sourceId = intval(isset($source['sid']) ? $source['sid'] : $sourceKey);
                if ($sourceId < 1 || empty($source['urls']) || !is_array($source['urls'])) {
                    continue;
                }
                $items = [];
                foreach ($source['urls'] as $episodeKey => $episode) {
                    $episodeId = intval(isset($episode['nid']) ? $episode['nid'] : $episodeKey);
                    if ($episodeId < 1 || !is_array($episode)) {
                        continue;
                    }
                    $items[] = [
                        'id' => (string) $episodeId,
                        'name' => self::nonEmptyText(isset($episode['name']) ? $episode['name'] : '', '下载 ' . $episodeId),
                        'href' => $this->downloadUrl($row, $sourceId, $episodeId),
                    ];
                }
                if (!empty($items)) {
                    $playerInfo = isset($source['player_info']) && is_array($source['player_info']) ? $source['player_info'] : [];
                    $sources[] = [
                        'id' => (string) $sourceId,
                        'name' => self::nonEmptyText(
                            isset($playerInfo['show']) ? $playerInfo['show'] : (isset($source['from']) ? $source['from'] : ''),
                            '下载线路 ' . $sourceId
                        ),
                        'tip' => trim(strip_tags((string) (isset($playerInfo['tip']) ? $playerInfo['tip'] : (isset($source['note']) ? $source['note'] : '')))),
                        'items' => $items,
                    ];
                }
            }
        }

        return [
            'siteName' => $this->siteName(),
            'video' => [
                'id' => (string) $vodId,
                'title' => self::nonEmptyText(isset($row['vod_name']) ? $row['vod_name'] : '', '未命名影片'),
            ],
            'access' => [
                'state' => $state['state'],
                'authorized' => $state['authorized'],
                'passwordRequired' => $state['passwordRequired'],
                'message' => $state['message'],
                'points' => $state['points'],
            ],
            'sources' => $sources,
        ];
    }

    public function plot($vodId)
    {
        $vodId = intval($vodId);
        $row = $this->vodRow($vodId, $this->plotFields());
        if (empty($row)) {
            throw new ApiException(404, '影片不存在');
        }
        $this->assertCategoryAccess($row);

        $plotList = function_exists('mac_plot_list')
            ? mac_plot_list(
                isset($row['vod_plot_name']) ? $row['vod_plot_name'] : '',
                isset($row['vod_plot_detail']) ? $row['vod_plot_detail'] : ''
            )
            : $this->fallbackPlotList(
                isset($row['vod_plot_name']) ? $row['vod_plot_name'] : '',
                isset($row['vod_plot_detail']) ? $row['vod_plot_detail'] : ''
            );
        $items = [];
        foreach ($this->rows($plotList) as $item) {
            $detail = self::plainText(isset($item['detail']) ? $item['detail'] : '', 10000);
            $items[] = [
                'name' => self::nonEmptyText(isset($item['name']) ? $item['name'] : '', '剧情'),
                'detail' => $detail !== '' ? $detail : '剧情待更新',
            ];
        }

        return [
            'siteName' => $this->siteName(),
            'video' => [
                'id' => (string) $vodId,
                'title' => self::nonEmptyText(isset($row['vod_name']) ? $row['vod_name'] : '', '未命名影片'),
                'summary' => self::plainText(isset($row['vod_blurb']) ? $row['vod_blurb'] : '', 500),
            ],
            'items' => $items,
        ];
    }

    public function verifyPassword($vodId, $scope, $password)
    {
        $vodId = intval($vodId);
        $scope = trim((string) $scope);
        $password = (string) $password;
        $types = ['detail' => 1, 'playback' => 4, 'download' => 5];
        $fields = ['detail' => 'vod_pwd', 'playback' => 'vod_pwd_play', 'download' => 'vod_pwd_down'];
        if (!isset($types[$scope])) {
            throw new ApiException(422, '密码验证范围不受支持');
        }

        $row = $this->vodRow($vodId, 'vod_id,' . $fields[$scope]);
        if (empty($row)) {
            throw new ApiException(404, '影片不存在');
        }
        if (!function_exists('session')) {
            throw new ApiException(503, 'MacCMS 会话服务不可用');
        }

        $sessionKey = '1-' . $types[$scope] . '-' . $vodId;
        if ((string) session($sessionKey) === '1') {
            return ['vodId' => (string) $vodId, 'scope' => $scope, 'authorized' => true];
        }
        if (function_exists('mac_get_time_span') && intval(mac_get_time_span('last_pwd')) < 5) {
            throw new ApiException(429, '密码验证过于频繁，请稍后重试');
        }

        $expected = (string) (isset($row[$fields[$scope]]) ? $row[$fields[$scope]] : '');
        if ($expected === '' || !hash_equals($expected, $password)) {
            throw new ApiException(422, '密码错误');
        }
        session($sessionKey, '1');

        return ['vodId' => (string) $vodId, 'scope' => $scope, 'authorized' => true];
    }

    public function assertEpisode($vodId, $sourceId, $episodeId)
    {
        $row = $this->vodRow(intval($vodId), $this->playbackFields(false));
        if (empty($row)) {
            throw new ApiException(404, '播放资源不存在');
        }
        $playList = $this->playList($row);
        if (empty($playList[intval($sourceId)]['urls'][intval($episodeId)])) {
            throw new ApiException(404, '播放资源不存在');
        }
    }

    public function assertVideo($vodId)
    {
        $row = $this->vodRow(intval($vodId), $this->accessFields());
        if (empty($row)) {
            throw new ApiException(404, '影片不存在');
        }
        $this->assertAccess($row, 2);
    }

    public function assertComment($commentId)
    {
        $row = Db::name('Comment')->field('comment_rid')->where([
            'comment_id' => intval($commentId),
            'comment_mid' => 1,
            'comment_status' => 1,
        ])->find();
        $row = $this->row($row);
        if (empty($row) || intval(isset($row['comment_rid']) ? $row['comment_rid'] : 0) < 1) {
            throw new ApiException(404, '评论不存在');
        }
        $this->assertVideo(intval($row['comment_rid']));
    }

    public function comments($vodId, $mid)
    {
        $row = intval($mid) === 1 ? $this->vodRow(intval($vodId), $this->accessFields()) : null;
        if (empty($row)) {
            throw new ApiException(404, '影片不存在');
        }
        $this->assertAccess($row, 2);
        if (isset($GLOBALS['config']['comment']['status']) && intval($GLOBALS['config']['comment']['status']) !== 1) {
            return [];
        }

        $limit = $this->configInteger('comment_limit', self::DEFAULT_COMMENT_LIMIT, 1, 200);
        $rows = Db::name('Comment')
            ->field('comment_id,comment_pid,comment_name,comment_content,comment_time,comment_up,comment_down')
            ->where([
                'comment_mid' => 1,
                'comment_rid' => intval($vodId),
                'comment_status' => 1,
            ])
            ->order('comment_time desc,comment_id desc')
            ->limit($limit)
            ->select();

        $items = [];
        foreach ($this->rows($rows) as $row) {
            $item = [
                'id' => (string) intval(isset($row['comment_id']) ? $row['comment_id'] : 0),
                'author' => self::nonEmptyText(isset($row['comment_name']) ? $row['comment_name'] : '', '访客'),
                'content' => self::plainText(isset($row['comment_content']) ? $row['comment_content'] : '', 5000),
                'createdAt' => self::formatTime(isset($row['comment_time']) ? $row['comment_time'] : 0),
                'likes' => max(0, intval(isset($row['comment_up']) ? $row['comment_up'] : 0)),
                'dislikes' => max(0, intval(isset($row['comment_down']) ? $row['comment_down'] : 0)),
            ];
            $parentId = intval(isset($row['comment_pid']) ? $row['comment_pid'] : 0);
            if ($parentId > 0) {
                $item['parentId'] = (string) $parentId;
            }
            if ($item['id'] !== '0') {
                $items[] = $item;
            }
        }

        return $items;
    }

    public static function mapVideoRow(array $row, array $typeList, array $playList, $fallbackImage)
    {
        $category = self::resolveCategory(isset($row['type_id']) ? $row['type_id'] : 0, $typeList);
        $poster = self::imageUrl(isset($row['vod_pic']) ? $row['vod_pic'] : '', $fallbackImage);
        $backdrop = self::imageUrl(isset($row['vod_pic_slide']) ? $row['vod_pic_slide'] : '', $poster);
        $timestamp = intval(isset($row['vod_time']) ? $row['vod_time'] : 0);

        return [
            'id' => (string) intval(isset($row['vod_id']) ? $row['vod_id'] : 0),
            'typeId' => (string) $category['id'],
            'typeName' => $category['name'],
            'title' => self::nonEmptyText(isset($row['vod_name']) ? $row['vod_name'] : '', '未命名影片'),
            'remark' => self::nonEmptyText(isset($row['vod_remarks']) ? $row['vod_remarks'] : '', '已收录'),
            'actor' => trim((string) (isset($row['vod_actor']) ? $row['vod_actor'] : '')),
            'director' => trim((string) (isset($row['vod_director']) ? $row['vod_director'] : '')),
            'year' => self::nonEmptyText(isset($row['vod_year']) ? $row['vod_year'] : '', '未知'),
            'area' => trim((string) (isset($row['vod_area']) ? $row['vod_area'] : '')),
            'class' => self::nonEmptyText(isset($row['vod_class']) ? $row['vod_class'] : '', $category['name']),
            'lang' => trim((string) (isset($row['vod_lang']) ? $row['vod_lang'] : '')),
            'letter' => trim((string) (isset($row['vod_letter']) ? $row['vod_letter'] : '')),
            'hits' => max(0, intval(isset($row['vod_hits']) ? $row['vod_hits'] : 0)),
            'score' => max(0, floatval(isset($row['vod_score']) ? $row['vod_score'] : 0)),
            'updated' => $timestamp > 0 ? date('Y-m-d H:i:s', $timestamp) : '1970-01-01 00:00:00',
            'poster' => $poster,
            'backdrop' => $backdrop,
            'duration' => self::nonEmptyText(isset($row['vod_duration']) ? $row['vod_duration'] : '', '未知时长'),
            'version' => self::nonEmptyText(isset($row['vod_version']) ? $row['vod_version'] : '', '正片'),
            'summary' => self::plainText(
                !empty($row['vod_content']) ? $row['vod_content'] : (isset($row['vod_blurb']) ? $row['vod_blurb'] : ''),
                180
            ),
            'episodes' => self::episodes($playList),
        ];
    }

    public static function mapContentCardRow(array $row, array $typeList, $fallbackImage, $search = false)
    {
        $card = [
            'id' => (string) intval(isset($row['vod_id']) ? $row['vod_id'] : 0),
            'title' => self::nonEmptyText(isset($row['vod_name']) ? $row['vod_name'] : '', '未命名影片'),
            'remark' => self::nonEmptyText(isset($row['vod_remarks']) ? $row['vod_remarks'] : '', '已收录'),
            'year' => self::nonEmptyText(isset($row['vod_year']) ? $row['vod_year'] : '', '未知'),
            'class' => self::nonEmptyText(isset($row['vod_class']) ? $row['vod_class'] : '', '其他'),
            'score' => max(0, floatval(isset($row['vod_score']) ? $row['vod_score'] : 0)),
            'poster' => self::imageUrl(isset($row['vod_pic']) ? $row['vod_pic'] : '', $fallbackImage),
        ];
        if ($search) {
            $category = self::resolveCategory(isset($row['type_id']) ? $row['type_id'] : 0, $typeList);
            $card['typeName'] = $category['name'];
            $card['actor'] = trim((string) (isset($row['vod_actor']) ? $row['vod_actor'] : ''));
            $card['summary'] = self::plainText(isset($row['vod_blurb']) ? $row['vod_blurb'] : '', 200);
        }

        return $card;
    }

    public static function episodes(array $playList)
    {
        $episodes = [];
        foreach ($playList as $sourceKey => $source) {
            $sourceId = intval($sourceKey);
            if ($sourceId < 1 || empty($source['urls']) || !is_array($source['urls'])) {
                continue;
            }
            foreach ($source['urls'] as $episodeKey => $episode) {
                $episodeId = intval($episodeKey);
                if ($episodeId < 1 || !is_array($episode)) {
                    continue;
                }
                $episodes[] = [
                    'id' => (string) $episodeId,
                    'no' => $episodeId,
                    'name' => self::nonEmptyText(
                        isset($episode['name']) ? $episode['name'] : (isset($episode['title']) ? $episode['title'] : ''),
                        '第' . $episodeId . '集'
                    ),
                    'sourceId' => (string) $sourceId,
                ];
            }
        }

        return $episodes;
    }

    private function playSources(array $playList)
    {
        $sources = [];
        foreach ($playList as $sourceKey => $source) {
            $sourceId = intval(isset($source['sid']) ? $source['sid'] : $sourceKey);
            if ($sourceId < 1 || empty($source['urls']) || !is_array($source['urls'])) {
                continue;
            }
            $episodes = [];
            foreach ($source['urls'] as $episodeKey => $episode) {
                $episodeId = intval(isset($episode['nid']) ? $episode['nid'] : $episodeKey);
                if ($episodeId < 1 || !is_array($episode)) {
                    continue;
                }
                $episodes[] = [
                    'id' => (string) $episodeId,
                    'no' => $episodeId,
                    'name' => self::nonEmptyText(isset($episode['name']) ? $episode['name'] : '', '第' . $episodeId . '集'),
                    'sourceId' => (string) $sourceId,
                ];
            }
            if (empty($episodes)) {
                continue;
            }
            $playerInfo = isset($source['player_info']) && is_array($source['player_info']) ? $source['player_info'] : [];
            $sources[] = [
                'id' => (string) $sourceId,
                'name' => self::nonEmptyText(
                    isset($playerInfo['show']) ? $playerInfo['show'] : (isset($source['from']) ? $source['from'] : ''),
                    '播放线路 ' . $sourceId
                ),
                'tip' => trim(strip_tags((string) (isset($playerInfo['tip']) ? $playerInfo['tip'] : (isset($source['note']) ? $source['note'] : '')))),
                'episodes' => $episodes,
            ];
        }
        return $sources;
    }

    public static function mapHomeCardRow(array $row, $fallbackImage)
    {
        return [
            'id' => (string) intval(isset($row['vod_id']) ? $row['vod_id'] : 0),
            'title' => self::nonEmptyText(isset($row['vod_name']) ? $row['vod_name'] : '', '未命名影片'),
            'remark' => self::nonEmptyText(isset($row['vod_remarks']) ? $row['vod_remarks'] : '', '已收录'),
            'year' => self::nonEmptyText(isset($row['vod_year']) ? $row['vod_year'] : '', '未知'),
            'class' => self::nonEmptyText(isset($row['vod_class']) ? $row['vod_class'] : '', '其他'),
            'score' => max(0, floatval(isset($row['vod_score']) ? $row['vod_score'] : 0)),
            'poster' => self::imageUrl(isset($row['vod_pic']) ? $row['vod_pic'] : '', $fallbackImage),
        ];
    }

    public static function mapHomeHeroRow(array $row, array $playList, $fallbackImage, $compact = false)
    {
        $episode = self::firstEpisode($playList, (bool) $compact);
        $id = intval(isset($row['vod_id']) ? $row['vod_id'] : 0);
        if ($id < 1 || $episode === null) {
            return null;
        }

        $poster = self::imageUrl(isset($row['vod_pic']) ? $row['vod_pic'] : '', $fallbackImage);
        return [
            'id' => (string) $id,
            'title' => self::nonEmptyText(isset($row['vod_name']) ? $row['vod_name'] : '', '未命名影片'),
            'year' => self::nonEmptyText(isset($row['vod_year']) ? $row['vod_year'] : '', '未知'),
            'class' => self::nonEmptyText(isset($row['vod_class']) ? $row['vod_class'] : '', '其他'),
            'backdrop' => self::imageUrl(isset($row['vod_pic_slide']) ? $row['vod_pic_slide'] : '', $poster),
            'duration' => self::nonEmptyText(isset($row['vod_duration']) ? $row['vod_duration'] : '', '未知时长'),
            'version' => self::nonEmptyText(isset($row['vod_version']) ? $row['vod_version'] : '', '正片'),
            'summary' => self::plainText(!empty($row['vod_blurb']) ? $row['vod_blurb'] : (isset($row['vod_content']) ? $row['vod_content'] : ''), 500),
            'episodes' => [$episode],
        ];
    }

    private function baseVodQuery(array $query, array $typeList)
    {
        $builder = Db::name('Vod')->where([
            'vod_status' => 1,
            'vod_recycle_time' => 0,
        ]);
        $builder = $this->applyListAccess($builder);
        if (!empty($query['playableOnly'])) {
            $builder = $builder->where('vod_play_from', '<>', '')->where('vod_play_url', '<>', '');
        }

        $typeId = intval(isset($query['typeId']) ? $query['typeId'] : 0);
        $typeIds = $this->typeIdsForQuery($query, $typeList);
        if (!empty($typeIds)) {
            $builder = $builder->where('type_id', 'in', $typeIds);
        } elseif ($typeId > 0) {
            $builder = $builder->where('vod_id', 0);
        }

        foreach (['area' => 'vod_area', 'year' => 'vod_year', 'lang' => 'vod_lang'] as $name => $field) {
            $value = trim((string) (isset($query[$name]) ? $query[$name] : ''));
            if ($value !== '') {
                $builder = $builder->where($field, $value);
            }
        }

        $class = trim((string) (isset($query['class']) ? $query['class'] : ''));
        if ($class !== '') {
            if (function_exists('mac_like_arr')) {
                $builder = $builder->where(['vod_class' => ['like', mac_like_arr($class), 'OR']]);
            } else {
                $builder = $builder->where('vod_class', 'like', '%' . $class . '%');
            }
        }

        $letter = trim((string) (isset($query['letter']) ? $query['letter'] : ''));
        if ($letter !== '') {
            $letters = $letter === '0~9' ? ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] : [$letter];
            $builder = $builder->where('vod_letter', 'in', $letters);
        }

        if (array_key_exists('keyword', $query)) {
            $keyword = trim((string) $query['keyword']);
            if ($keyword === '') {
                $builder = $builder->where('vod_id', 0);
            } else {
                $like = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $keyword) . '%';
                $builder = $builder->where(function ($search) use ($like) {
                    $search->where('vod_name', 'like', $like)
                        ->whereOr('vod_actor', 'like', $like)
                        ->whereOr('vod_director', 'like', $like);
                });
            }
        }

        return $builder;
    }

    protected function typeIdsForQuery(array $query, array $typeList)
    {
        $typeId = intval(isset($query['typeId']) ? $query['typeId'] : 0);
        $typeIds = $this->typeScope($typeId, $typeList);
        if (!in_array(isset($query['scope']) ? $query['scope'] : '', ['library', 'yearly'], true)) {
            return $typeIds;
        }

        $scopeIds = $this->homeTypeScope($typeList);
        return $typeId < 1 ? $scopeIds : array_values(array_intersect($typeIds, $scopeIds));
    }

    private function mapRows($rows, array $typeList, $requireEpisodes = true)
    {
        $videos = [];
        foreach ($this->rows($rows) as $row) {
            $playList = $requireEpisodes ? $this->playList($row) : [];
            $video = self::mapVideoRow($row, $typeList, $playList, $this->fallbackImage());
            if ($video['id'] !== '0' && (!$requireEpisodes || !empty($video['episodes']))) {
                $videos[] = $video;
            }
        }
        return $videos;
    }

    private function mapContentCardRows($rows, array $typeList, $search)
    {
        $videos = [];
        foreach ($this->rows($rows) as $row) {
            $video = self::mapContentCardRow($row, $typeList, $this->fallbackImage(), (bool) $search);
            if ($video['id'] !== '0') {
                $videos[] = $video;
            }
        }
        return $videos;
    }

    private function pageRows(array $query, array $typeList, $sort, $page, $pageSize, $excludeId = 0, $withPlayback = true, $fields = null)
    {
        $idQuery = $this->baseVodQuery($query, $typeList);
        if (intval($excludeId) > 0) {
            $idQuery = $idQuery->where('vod_id', '<>', intval($excludeId));
        }
        $forcedIndex = $this->shouldUsePrimaryScan($query, $typeList)
            ? 'PRIMARY'
            : $this->forcedIndexForQuery($query, $sort);
        if ($forcedIndex !== '') {
            $idQuery = $idQuery->force($forcedIndex);
        }
        $idRows = $idQuery
            ->field('vod_id')
            ->order($this->sortOrder($sort))
            ->page(max(1, intval($page)), max(1, intval($pageSize)))
            ->select();
        $ids = [];
        foreach ($this->rows($idRows) as $row) {
            $id = intval(isset($row['vod_id']) ? $row['vod_id'] : 0);
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        if (empty($ids)) {
            return [];
        }

        $selectedFields = is_string($fields) && $fields !== '' ? $fields : $this->videoFields($withPlayback);
        $rows = $this->rows(Db::name('Vod')->where('vod_id', 'in', $ids)->field($selectedFields)->select());
        $byId = [];
        foreach ($rows as $row) {
            $byId[intval(isset($row['vod_id']) ? $row['vod_id'] : 0)] = $row;
        }
        $ordered = [];
        foreach ($ids as $id) {
            if (isset($byId[$id])) {
                $ordered[] = $byId[$id];
            }
        }
        return $ordered;
    }

    private function videoFields($withPlayback = true)
    {
        $fields = [
            'vod_id',
            'vod_en',
            'type_id',
            'vod_name',
            'vod_remarks',
            'vod_actor',
            'vod_director',
            'vod_year',
            'vod_area',
            'vod_class',
            'vod_lang',
            'vod_letter',
            'vod_hits',
            'vod_score',
            'vod_time',
            'vod_pic',
            'vod_pic_slide',
            'vod_duration',
            'vod_version',
            'vod_blurb',
            'vod_content',
        ];
        if ($withPlayback) {
            $fields = array_merge($fields, ['vod_play_from', 'vod_play_server', 'vod_play_note', 'vod_play_url']);
        }
        return implode(',', $fields);
    }

    private function contentCardFields($search)
    {
        $fields = [
            'vod_id',
            'vod_name',
            'vod_remarks',
            'vod_year',
            'vod_class',
            'vod_score',
            'vod_pic',
        ];
        if ($search) {
            $fields = array_merge($fields, ['type_id', 'vod_actor', 'vod_blurb']);
        }
        return implode(',', $fields);
    }

    private function homeCardFields()
    {
        return 'vod_id,vod_name,vod_remarks,vod_year,vod_class,vod_score,vod_pic';
    }

    private function homeHeroFields()
    {
        return implode(',', [
            'vod_id',
            'vod_name',
            'vod_year',
            'vod_class',
            'vod_pic',
            'vod_pic_slide',
            'vod_duration',
            'vod_version',
            'vod_blurb',
            'vod_content',
            'vod_play_from',
            'vod_play_server',
            'vod_play_note',
            'vod_play_url',
        ]);
    }

    private function accessFields()
    {
        return 'vod_id,type_id,vod_copyright,vod_pwd';
    }

    protected function gateFields($scope, $withEpisode)
    {
        $scope = trim((string) $scope);
        $fields = [
            'vod_id',
            'type_id',
            'vod_name',
            'vod_copyright',
        ];

        if ($scope === 'detail' || $scope === 'unavailable') {
            $fields[] = 'vod_pwd';
        } elseif ($scope === 'playback' || $scope === 'confirm') {
            $fields = array_merge($fields, [
                'vod_pwd_play',
                'vod_points',
                'vod_points_play',
                'vod_trysee',
            ]);
            if ($withEpisode) {
                $fields = array_merge($fields, [
                    'vod_play_from',
                    'vod_play_server',
                    'vod_play_note',
                    'vod_play_url',
                ]);
            }
        } elseif ($scope === 'download') {
            $fields = array_merge($fields, [
                'vod_pwd_down',
                'vod_points',
                'vod_points_down',
            ]);
            if ($withEpisode) {
                $fields = array_merge($fields, [
                    'vod_down_from',
                    'vod_down_server',
                    'vod_down_note',
                    'vod_down_url',
                ]);
            }
        }

        return implode(',', $fields);
    }

    private function downloadFields()
    {
        return implode(',', [
            'vod_id',
            'vod_en',
            'type_id',
            'vod_name',
            'vod_pwd_down',
            'vod_points',
            'vod_points_down',
            'vod_down_from',
            'vod_down_server',
            'vod_down_note',
            'vod_down_url',
        ]);
    }

    private function plotFields()
    {
        return 'vod_id,type_id,vod_name,vod_blurb,vod_plot_name,vod_plot_detail';
    }

    private function playbackFields($withDisplay)
    {
        $fields = explode(',', $this->gateFields('playback', true));
        if ($withDisplay) {
            $fields = array_merge($fields, ['vod_name', 'vod_pic']);
        }
        return implode(',', array_values(array_unique($fields)));
    }

    private function detailFields($compact)
    {
        $fields = explode(',', $this->videoFields(true));
        if ($compact) {
            $fields = array_values(array_diff($fields, ['vod_letter', 'vod_version']));
        }
        return implode(',', $fields) . ',vod_copyright,vod_pwd,vod_score_num,vod_up,vod_down';
    }

    private function sortOrder($sort)
    {
        if ($sort === 'hot') {
            return 'vod_hits desc,vod_id desc';
        }
        if ($sort === 'score') {
            return 'vod_score desc,vod_id desc';
        }
        return 'vod_time desc,vod_id desc';
    }

    private function sortIndex($sort)
    {
        if ($sort === 'hot') {
            return 'vod_hits';
        }
        if ($sort === 'score') {
            return 'vod_score';
        }
        return 'vod_time';
    }

    protected function forcedIndexForQuery(array $query, $sort)
    {
        if (array_key_exists('keyword', $query)
            || intval(isset($query['typeId']) ? $query['typeId'] : 0) > 0
            || !empty($query['scope'])) {
            return '';
        }
        foreach (['area', 'year', 'lang', 'letter'] as $name) {
            if (trim((string) (isset($query[$name]) ? $query[$name] : '')) !== '') {
                return '';
            }
        }
        return $this->sortIndex($sort);
    }

    protected function shouldUsePrimaryScan(array $query, array $typeList)
    {
        return count($this->typeIdsForQuery($query, $typeList)) > 1;
    }

    private function homeVideo(array $video)
    {
        return [
            'id' => $video['id'],
            'title' => $video['title'],
            'category' => $video['typeName'],
            'remark' => $video['remark'],
            'year' => $video['year'],
            'class' => $video['class'],
            'hits' => $video['hits'],
            'score' => $video['score'],
            'updated' => $video['updated'],
            'poster' => $video['poster'],
            'backdrop' => $video['backdrop'],
            'duration' => $video['duration'],
            'version' => $video['version'],
            'summary' => $video['summary'],
            'episodes' => array_slice($video['episodes'], 0, 1),
        ];
    }

    private function homeCategories(array $typeList)
    {
        $blocked = array_fill_keys($this->blockedTypeIds(), true);
        $categories = [];
        foreach (array_map('intval', explode(',', self::HOME_TYPE_IDS)) as $typeId) {
            if (!isset($typeList[$typeId])) {
                continue;
            }
            $scope = array_values(array_filter($this->typeScope($typeId, $typeList), function ($id) use ($blocked) {
                return !isset($blocked[intval($id)]);
            }));
            if (empty($scope)) {
                continue;
            }
            $categories[] = [
                'id' => (string) $typeId,
                'name' => self::nonEmptyText(isset($typeList[$typeId]['type_name']) ? $typeList[$typeId]['type_name'] : '', '其他'),
            ];
        }
        return $categories;
    }

    private function nativeVodRows($typeIds, $limit, $by, $year, $cacheSeconds, $fields, $cacheNamespace)
    {
        if (!function_exists('model')) {
            throw new ApiException(503, 'MacCMS 内容服务不可用');
        }
        $model = model('Vod');
        if (!is_object($model) || !method_exists($model, 'listCacheData')) {
            throw new ApiException(503, 'MacCMS 内容服务不可用');
        }

        $fieldSignature = substr(hash('sha256', (string) $fields), 0, 12);
        $blockedTypeIds = $this->blockedTypeIds();
        $accessSignature = $this->accessCacheKey();
        $result = $model->listCacheData([
            'order' => 'desc',
            'by' => (string) $by,
            'type' => (string) $typeIds,
            'ids' => '',
            'rel' => '',
            'paging' => 'no',
            'pageurl' => 'pingfangapi-home-' . preg_replace('/[^a-z0-9-]/i', '-', (string) $cacheNamespace) . '-' . $fieldSignature . '-' . $accessSignature,
            'level' => '',
            'area' => '',
            'lang' => '',
            'state' => '',
            'wd' => '',
            'tag' => '',
            'class' => '',
            'letter' => '',
            'actor' => '',
            'director' => '',
            'version' => '',
            'year' => (string) $year,
            'start' => 0,
            'num' => max(1, intval($limit)),
            'half' => 0,
            'weekday' => '',
            'tv' => '',
            'timeadd' => '',
            'timehits' => '',
            'time' => '',
            'hitsmonth' => '',
            'hitsweek' => '',
            'hitsday' => '',
            'hits' => '',
            'not' => '',
            'cachetime' => max(0, intval($cacheSeconds)),
            'isend' => '',
            'plot' => '',
            'typenot' => implode(',', $blockedTypeIds),
            'name' => '',
        ], (string) $fields);
        if (!is_array($result) || intval(isset($result['code']) ? $result['code'] : 0) !== 1) {
            throw new ApiException(503, 'MacCMS 内容服务暂不可用');
        }

        return $this->rows(isset($result['list']) ? $result['list'] : []);
    }

    private function homeHeroRows($rows, $compact)
    {
        $videos = [];
        foreach ($this->rows($rows) as $row) {
            $video = self::mapHomeHeroRow($row, $this->playList($row), $this->fallbackImage(), (bool) $compact);
            if ($video !== null) {
                $videos[] = $video;
            }
            if (count($videos) >= 5) {
                break;
            }
        }
        return $videos;
    }

    private function homeCardRows($rows)
    {
        $videos = [];
        foreach ($this->rows($rows) as $row) {
            $video = self::mapHomeCardRow($row, $this->fallbackImage());
            if ($video['id'] !== '0') {
                $videos[] = $video;
            }
        }
        return $videos;
    }

    private static function firstEpisode(array $playList, $compact = false)
    {
        foreach ($playList as $sourceKey => $source) {
            $sourceId = intval($sourceKey);
            if ($sourceId < 1 || empty($source['urls']) || !is_array($source['urls'])) {
                continue;
            }
            foreach ($source['urls'] as $episodeKey => $episode) {
                $episodeId = intval($episodeKey);
                if ($episodeId < 1 || !is_array($episode)) {
                    continue;
                }
                $result = [
                    'id' => (string) $episodeId,
                    'no' => $episodeId,
                    'name' => self::nonEmptyText(
                        isset($episode['name']) ? $episode['name'] : (isset($episode['title']) ? $episode['title'] : ''),
                        '第' . $episodeId . '集'
                    ),
                    'sourceId' => (string) $sourceId,
                ];
                if ($compact) {
                    return [
                        'id' => $result['id'],
                        'sourceId' => $result['sourceId'],
                    ];
                }
                return $result;
            }
        }
        return null;
    }

    private function vodRow($vodId, $fields)
    {
        if ($vodId < 1) {
            return null;
        }
        $row = Db::name('Vod')->where([
            'vod_id' => $vodId,
            'vod_status' => 1,
            'vod_recycle_time' => 0,
        ])->field((string) $fields)->find();

        return $this->row($row);
    }

    protected function assertAccessEpisode(array $row, $scope, $sourceId, $episodeId)
    {
        $sourceId = intval($sourceId);
        $episodeId = intval($episodeId);
        if ($sourceId < 1 && $episodeId < 1) {
            return;
        }

        if ($scope === 'playback' || $scope === 'confirm') {
            if ($sourceId < 1 || $episodeId < 1 || empty($this->playList($row)[$sourceId]['urls'][$episodeId])) {
                throw new ApiException(404, '播放资源不存在');
            }
        } elseif ($scope === 'download'
            && ($sourceId < 1 || $episodeId < 1 || empty($this->downloadList($row)[$sourceId]['urls'][$episodeId]))) {
            throw new ApiException(404, '下载资源不存在');
        }
    }

    private function playList(array $row)
    {
        if (!function_exists('mac_play_list')) {
            throw new ApiException(503, 'MacCMS 播放列表解析器不可用');
        }

        $list = mac_play_list(
            isset($row['vod_play_from']) ? $row['vod_play_from'] : '',
            isset($row['vod_play_url']) ? $row['vod_play_url'] : '',
            isset($row['vod_play_server']) ? $row['vod_play_server'] : '',
            isset($row['vod_play_note']) ? $row['vod_play_note'] : '',
            'play'
        );

        return is_array($list) ? $list : [];
    }

    private function downloadList(array $row)
    {
        if (!function_exists('mac_play_list')) {
            throw new ApiException(503, 'MacCMS 下载列表解析器不可用');
        }

        $list = mac_play_list(
            isset($row['vod_down_from']) ? $row['vod_down_from'] : '',
            isset($row['vod_down_url']) ? $row['vod_down_url'] : '',
            isset($row['vod_down_server']) ? $row['vod_down_server'] : '',
            isset($row['vod_down_note']) ? $row['vod_down_note'] : '',
            'down'
        );

        return is_array($list) ? $list : [];
    }

    private function downloadUrl(array $row, $sourceId, $episodeId)
    {
        if (!function_exists('url')) {
            throw new ApiException(503, 'MacCMS 下载路由不可用');
        }
        $value = url('vod/down', [
            'id' => $this->nativeVodRouteId($row),
            'sid' => intval($sourceId),
            'nid' => intval($episodeId),
        ]);
        return $this->safeSameOriginUrl($value, 'MacCMS 下载路由不可用');
    }

    protected function nativeVodRouteId(array $row)
    {
        $vodId = intval(isset($row['vod_id']) ? $row['vod_id'] : 0);
        $mode = intval(isset($GLOBALS['config']['rewrite']['vod_id']) ? $GLOBALS['config']['rewrite']['vod_id'] : 0);
        if ($mode === 1) {
            $slug = trim((string) (isset($row['vod_en']) ? $row['vod_en'] : ''));
            if ($slug === '') {
                throw new ApiException(503, 'MacCMS 下载路由不可用');
            }
            return $slug;
        }
        if ($mode === 2) {
            if (!function_exists('mac_alphaID')) {
                throw new ApiException(503, 'MacCMS 下载路由不可用');
            }
            $encoded = trim((string) mac_alphaID(
                $vodId,
                false,
                isset($GLOBALS['config']['rewrite']['encode_len']) ? $GLOBALS['config']['rewrite']['encode_len'] : 0,
                isset($GLOBALS['config']['rewrite']['encode_key']) ? $GLOBALS['config']['rewrite']['encode_key'] : ''
            ));
            if ($encoded === '') {
                throw new ApiException(503, 'MacCMS 下载路由不可用');
            }
            return $encoded;
        }
        return $vodId;
    }

    private function playerUrl($vodId, $sourceId, $episodeId)
    {
        if (!function_exists('url')) {
            throw new ApiException(503, 'MacCMS 播放器路由不可用');
        }
        $value = url('pingfangapi/player', [
            'id' => intval($vodId),
            'sid' => intval($sourceId),
            'nid' => intval($episodeId),
        ]);
        return $this->safeSameOriginUrl($value, 'MacCMS 播放器路由不可用');
    }

    private function safeSameOriginUrl($value, $errorMessage)
    {
        $value = trim((string) $value);
        if ($value === '') {
            throw new ApiException(503, (string) $errorMessage);
        }

        if (preg_match('#^https?://#i', $value)) {
            $urlHost = strtolower((string) parse_url($value, PHP_URL_HOST));
            $urlScheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
            $urlPort = intval(parse_url($value, PHP_URL_PORT));
            $requestHost = '';
            $requestScheme = '';
            $requestPort = 0;
            if (function_exists('request')) {
                $request = request();
                $requestScheme = method_exists($request, 'isSsl') && $request->isSsl() ? 'https' : 'http';
                $hostParts = parse_url('http://' . (string) $request->host());
                $requestHost = is_array($hostParts) && isset($hostParts['host']) ? strtolower((string) $hostParts['host']) : '';
                $requestPort = is_array($hostParts) && isset($hostParts['port'])
                    ? intval($hostParts['port'])
                    : ($requestScheme === 'https' ? 443 : 80);
            }
            if ($urlPort < 1) {
                $urlPort = $urlScheme === 'https' ? 443 : 80;
            }
            if ($urlHost === '' || $requestHost === '' || $urlHost !== $requestHost || $urlScheme !== $requestScheme || $urlPort !== $requestPort) {
                throw new ApiException(503, (string) $errorMessage);
            }
            $path = (string) parse_url($value, PHP_URL_PATH);
            $query = (string) parse_url($value, PHP_URL_QUERY);
            $fragment = (string) parse_url($value, PHP_URL_FRAGMENT);
            $value = $path . ($query !== '' ? '?' . $query : '') . ($fragment !== '' ? '#' . $fragment : '');
        } elseif (strpos($value, '//') === 0 || preg_match('/^[a-z][a-z0-9+.-]*:/i', $value)) {
            throw new ApiException(503, (string) $errorMessage);
        }

        return $value;
    }

    protected function accessState(array $row, $scope, $sourceId, $episodeId)
    {
        $scope = (string) $scope;
        $param = [
            'id' => intval(isset($row['vod_id']) ? $row['vod_id'] : 0),
            'sid' => max(1, intval($sourceId)),
            'nid' => max(1, intval($episodeId)),
        ];
        $popedom = 2;
        $flag = '';
        $trysee = 0;
        if ($scope === 'playback' || $scope === 'confirm') {
            $popedom = 3;
            $flag = 'play';
            $trysee = intval(isset($GLOBALS['config']['user']['trysee']) ? $GLOBALS['config']['user']['trysee'] : 0);
            if (intval(isset($row['vod_trysee']) ? $row['vod_trysee'] : 0) > 0) {
                $trysee = intval($row['vod_trysee']);
            }
        } elseif ($scope === 'download') {
            $popedom = 4;
            $flag = 'down';
        }

        $result = call_user_func($this->accessChecker, intval(isset($row['type_id']) ? $row['type_id'] : 0), $popedom, $param, $flag, $row, $trysee);
        $result = is_array($result) ? $result : [];
        $allowed = intval(isset($result['code']) ? $result['code'] : 0) === 1;
        $tryseeMinutes = max(0, intval(isset($result['trysee']) ? $result['trysee'] : 0));
        $state = $tryseeMinutes > 0 ? 'trial' : ($allowed ? 'allowed' : (!empty($result['confirm']) ? 'confirm' : 'permission'));
        $message = trim((string) (isset($result['msg']) ? $result['msg'] : ''));
        $points = max(0, intval(isset($result['points']) ? $result['points'] : 0));
        $passwordRequired = false;

        $copyrightStatus = intval(isset($GLOBALS['config']['app']['copyright_status']) ? $GLOBALS['config']['app']['copyright_status'] : 0);
        if (intval(isset($row['vod_copyright']) ? $row['vod_copyright'] : 0) === 1) {
            $isPlayback = $scope === 'playback' || $scope === 'confirm';
            $blocked = $isPlayback && $copyrightStatus === 3;
            $blocked = $blocked || (($allowed || $tryseeMinutes > 0)
                && (($isPlayback && $copyrightStatus === 4)
                    || (($scope === 'detail' || $scope === 'unavailable') && $copyrightStatus === 2)));
            if ($blocked) {
                $state = 'copyright';
                $allowed = false;
                $tryseeMinutes = 0;
                $points = 0;
                $message = '该内容受版权限制';
            }
        }

        if ($allowed || $tryseeMinutes > 0) {
            $passwordField = '';
            $passwordType = 0;
            if ($scope === 'detail' || $scope === 'unavailable') {
                $passwordField = 'vod_pwd';
                $passwordType = 1;
            } elseif ($scope === 'playback' || $scope === 'confirm') {
                $passwordField = 'vod_pwd_play';
                $passwordType = 4;
            } elseif ($scope === 'download') {
                $passwordField = 'vod_pwd_down';
                $passwordType = 5;
            }
            if ($passwordField !== '' && trim((string) (isset($row[$passwordField]) ? $row[$passwordField] : '')) !== '') {
                $sessionAllowed = function_exists('session')
                    && (string) session('1-' . $passwordType . '-' . intval($row['vod_id'])) === '1';
                if (!$sessionAllowed) {
                    $passwordRequired = true;
                    $allowed = false;
                    $tryseeMinutes = 0;
                    $state = 'password';
                    $message = '该内容需要密码验证';
                }
            }
        }

        if ($message === '') {
            $message = $state === 'allowed' ? '允许访问' : ($state === 'trial' ? '允许试看' : '无权访问该内容');
        }
        return [
            'state' => $state,
            'authorized' => $allowed || $state === 'trial',
            'passwordRequired' => $passwordRequired,
            'message' => $message,
            'points' => $points,
            'tryseeMinutes' => $tryseeMinutes,
        ];
    }

    protected function assertPlaybackAccess(array $row, $sourceId, $episodeId)
    {
        $access = $this->accessState($row, 'playback', $sourceId, $episodeId);
        if (empty($access['authorized'])) {
            throw new ApiException(403, isset($access['message']) ? $access['message'] : '无权播放该内容');
        }
    }

    private function assertCategoryAccess(array $row)
    {
        $result = call_user_func($this->accessChecker, intval(isset($row['type_id']) ? $row['type_id'] : 0), 2, [], '', $row, 0);
        if (!is_array($result) || intval(isset($result['code']) ? $result['code'] : 0) !== 1) {
            $message = is_array($result) && !empty($result['msg']) ? (string) $result['msg'] : '无权访问该内容';
            throw new ApiException(403, $message);
        }
    }

    private function fallbackPlotList($names, $details)
    {
        $nameList = trim((string) $names) === '' ? [] : explode('$$$', (string) $names);
        $detailList = trim((string) $details) === '' ? [] : explode('$$$', (string) $details);
        $items = [];
        foreach ($nameList as $index => $name) {
            $items[] = [
                'name' => $name,
                'detail' => isset($detailList[$index]) ? $detailList[$index] : '',
            ];
        }
        return $items;
    }

    private function typeList()
    {
        $list = model('Type')->getCache('type_list');
        $out = [];
        foreach ($this->rows($list) as $key => $row) {
            $id = intval(isset($row['type_id']) ? $row['type_id'] : $key);
            if ($id > 0) {
                $out[$id] = $row;
            }
        }

        return $out;
    }

    private function typeScope($typeId, array $typeList)
    {
        $typeId = intval($typeId);
        if ($typeId < 1 || !isset($typeList[$typeId])) {
            return [];
        }

        $ids = [$typeId => $typeId];
        do {
            $changed = false;
            foreach ($typeList as $id => $type) {
                $parentId = intval(isset($type['type_pid']) ? $type['type_pid'] : 0);
                if (isset($ids[$parentId]) && !isset($ids[intval($id)])) {
                    $ids[intval($id)] = intval($id);
                    $changed = true;
                }
            }
        } while ($changed);

        return array_values($ids);
    }

    private function homeTypeScope(array $typeList)
    {
        $ids = [];
        foreach (array_map('intval', explode(',', self::HOME_TYPE_IDS)) as $typeId) {
            foreach ($this->typeScope($typeId, $typeList) as $id) {
                $ids[intval($id)] = intval($id);
            }
        }
        return array_values(array_filter($ids, function ($id) {
            return !in_array(intval($id), $this->blockedTypeIds(), true);
        }));
    }

    private function categoryContext($typeId, array $typeList)
    {
        $typeId = intval($typeId);
        $current = $this->visibleType($typeId, $typeList);
        if ($current === null) {
            return ['current' => null, 'parent' => null, 'children' => []];
        }

        $parentId = intval(isset($current['type_pid']) ? $current['type_pid'] : 0);
        $parent = $parentId > 0 ? $this->visibleType($parentId, $typeList) : null;
        $childrenParentId = $parent !== null ? intval($parent['type_id']) : intval($current['type_id']);
        $children = [];
        foreach ($typeList as $id => $type) {
            if (intval(isset($type['type_pid']) ? $type['type_pid'] : 0) !== $childrenParentId) {
                continue;
            }
            $visible = $this->visibleType(intval(isset($type['type_id']) ? $type['type_id'] : $id), $typeList);
            if ($visible !== null) {
                $children[] = $visible;
            }
        }
        usort($children, function ($left, $right) {
            $sort = intval(isset($left['type_sort']) ? $left['type_sort'] : 0) - intval(isset($right['type_sort']) ? $right['type_sort'] : 0);
            return $sort !== 0 ? $sort : intval($left['type_id']) - intval($right['type_id']);
        });

        return [
            'current' => $this->categoryDescriptor($current),
            'parent' => $parent === null ? null : $this->categoryDescriptor($parent),
            'children' => array_map(function ($type) {
                return $this->categoryDescriptor($type);
            }, $children),
        ];
    }

    private function visibleType($typeId, array $typeList)
    {
        $typeId = intval($typeId);
        if ($typeId < 1 || !isset($typeList[$typeId]) || in_array($typeId, $this->blockedTypeIds(), true)) {
            return null;
        }
        $type = $typeList[$typeId];
        if (intval(isset($type['type_mid']) ? $type['type_mid'] : 1) !== 1
            || intval(isset($type['type_status']) ? $type['type_status'] : 1) !== 1) {
            return null;
        }
        return $type;
    }

    private function categoryDescriptor(array $type)
    {
        $parentId = intval(isset($type['type_pid']) ? $type['type_pid'] : 0);
        return [
            'id' => (string) intval(isset($type['type_id']) ? $type['type_id'] : 0),
            'name' => self::nonEmptyText(isset($type['type_name']) ? $type['type_name'] : '', '其他'),
            'parentId' => $parentId > 0 ? (string) $parentId : null,
        ];
    }

    private function categories(array $typeList)
    {
        $cacheSeconds = $this->configInteger(
            'summary_cache_seconds',
            self::DEFAULT_SUMMARY_CACHE_SECONDS,
            0,
            self::MAX_SUMMARY_CACHE_SECONDS
        );
        $cacheKey = 'pingfangapi_categories_' . self::CONTENT_CACHE_VERSION . '_' . $this->accessCacheKey();
        if ($cacheSeconds > 0 && function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached)) {
                return $cached;
            }
        }

        $counts = $this->applyListAccess(Db::name('Vod')->where([
            'vod_status' => 1,
            'vod_recycle_time' => 0,
        ]))->force('vod_time')
            ->field('type_id,count(*) as total')
            ->group('type_id')
            ->select();

        $totals = [];
        foreach ($this->rows($counts) as $count) {
            $category = self::resolveCategory(isset($count['type_id']) ? $count['type_id'] : 0, $typeList);
            $id = intval($category['id']);
            $totals[$id] = intval(isset($totals[$id]) ? $totals[$id] : 0) + max(0, intval(isset($count['total']) ? $count['total'] : 0));
        }

        $rows = [];
        foreach ($totals as $id => $total) {
            if ($total < 1) {
                continue;
            }
            $type = isset($typeList[$id]) ? $typeList[$id] : [];
            $rows[] = [
                'id' => (string) $id,
                'name' => self::nonEmptyText(isset($type['type_name']) ? $type['type_name'] : '', '其他'),
                'total' => $total,
                'sort' => intval(isset($type['type_sort']) ? $type['type_sort'] : 0),
            ];
        }
        usort($rows, function ($left, $right) {
            if ($left['sort'] === $right['sort']) {
                return intval($left['id']) - intval($right['id']);
            }
            return $left['sort'] - $right['sort'];
        });

        $categories = [];
        foreach ($rows as $row) {
            unset($row['sort']);
            $categories[] = $row;
        }

        if ($cacheSeconds > 0 && function_exists('cache')) {
            cache($cacheKey, $categories, $cacheSeconds);
        }

        return $categories;
    }

    protected function catalogCategories(array $typeList, $scope = '')
    {
        $blocked = array_fill_keys($this->blockedTypeIds(), true);
        $scoped = in_array((string) $scope, ['library', 'yearly'], true)
            ? array_fill_keys(array_map('intval', explode(',', self::HOME_TYPE_IDS)), true)
            : null;
        $rows = [];
        foreach ($typeList as $id => $type) {
            $id = intval(isset($type['type_id']) ? $type['type_id'] : $id);
            if ($id < 1
                || intval(isset($type['type_pid']) ? $type['type_pid'] : 0) !== 0
                || intval(isset($type['type_mid']) ? $type['type_mid'] : 1) !== 1
                || intval(isset($type['type_status']) ? $type['type_status'] : 1) !== 1
                || isset($blocked[$id])
                || ($scoped !== null && !isset($scoped[$id]))) {
                continue;
            }
            $rows[] = [
                'id' => (string) $id,
                'name' => self::nonEmptyText(isset($type['type_name']) ? $type['type_name'] : '', '其他'),
                'sort' => intval(isset($type['type_sort']) ? $type['type_sort'] : 0),
            ];
        }
        usort($rows, function ($left, $right) {
            if ($left['sort'] === $right['sort']) {
                return intval($left['id']) - intval($right['id']);
            }
            return $left['sort'] - $right['sort'];
        });

        $categories = [];
        foreach ($rows as $row) {
            unset($row['sort']);
            $categories[] = $row;
        }
        return $categories;
    }

    protected function categoryTotalForQuery(array $query, array $categories)
    {
        foreach (['area', 'year', 'class', 'lang', 'letter', 'keyword', 'playableOnly', 'scope'] as $name) {
            if (array_key_exists($name, $query)) {
                return null;
            }
        }

        $typeId = intval(isset($query['typeId']) ? $query['typeId'] : 0);
        if ($typeId < 1) {
            return array_sum(array_map(function ($category) {
                return max(0, intval(isset($category['total']) ? $category['total'] : 0));
            }, $categories));
        }

        foreach ($categories as $category) {
            if (intval(isset($category['id']) ? $category['id'] : 0) === $typeId) {
                return max(0, intval(isset($category['total']) ? $category['total'] : 0));
            }
        }
        return null;
    }

    private function queryTotal(array $query, array $typeList)
    {
        $cacheSeconds = $this->configInteger(
            'summary_cache_seconds',
            self::DEFAULT_SUMMARY_CACHE_SECONDS,
            0,
            self::MAX_SUMMARY_CACHE_SECONDS
        );
        $filters = [];
        foreach (['typeId', 'area', 'year', 'class', 'lang', 'letter', 'keyword', 'playableOnly', 'scope'] as $name) {
            if (array_key_exists($name, $query)) {
                $filters[$name] = $query[$name];
            }
        }
        $cacheKey = 'pingfangapi_content_total_' . self::CONTENT_CACHE_VERSION . '_'
            . $this->accessCacheKey() . '_' . substr(hash('sha256', serialize($filters)), 0, 24);
        if ($cacheSeconds > 0 && function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached) && isset($cached['total'])) {
                return max(0, intval($cached['total']));
            }
        }

        $builder = $this->baseVodQuery($query, $typeList);
        $forcedIndex = $this->shouldUsePrimaryScan($query, $typeList)
            ? 'PRIMARY'
            : $this->forcedIndexForQuery($query, 'latest');
        if ($forcedIndex !== '') {
            $builder = $builder->force($forcedIndex);
        }
        $total = intval($builder->count());
        if ($cacheSeconds > 0 && function_exists('cache')) {
            cache($cacheKey, ['total' => $total], $cacheSeconds);
        }
        return $total;
    }

    private function publicCategories(array $categories)
    {
        $out = [];
        foreach ($categories as $category) {
            $out[] = [
                'id' => (string) $category['id'],
                'name' => (string) $category['name'],
            ];
        }
        return $out;
    }

    private function classOptions(array $query, array $typeList)
    {
        $facetQuery = $this->facetQuery($query, 'class');
        $typeId = intval(isset($query['typeId']) ? $query['typeId'] : 0);
        $cacheSeconds = $this->configInteger(
            'summary_cache_seconds',
            self::DEFAULT_SUMMARY_CACHE_SECONDS,
            0,
            self::MAX_SUMMARY_CACHE_SECONDS
        );
        $cacheKey = 'pingfangapi_classes_' . self::CONTENT_CACHE_VERSION . '_' . $this->accessCacheKey()
            . '_' . substr(hash('sha256', serialize($facetQuery)), 0, 24);
        if ($cacheSeconds > 0 && function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached)) {
                return $cached;
            }
        }

        $builder = $this->baseVodQuery($facetQuery, $typeList);
        if ($this->shouldUsePrimaryScan($facetQuery, $typeList)) {
            $builder = $builder->force('PRIMARY');
        }
        $rows = $builder->where('vod_class', '<>', '')
            ->field('vod_class as value,count(*) as total')
            ->group('vod_class')
            ->order('total desc')
            ->limit(200)
            ->select();
        $available = [];
        foreach ($this->rows($rows) as $row) {
            foreach ($this->csvValues(isset($row['value']) ? $row['value'] : '') as $value) {
                $available[$value] = $value;
            }
        }
        $configured = $this->configuredClasses($typeId, $typeList);
        $options = empty($configured)
            ? array_values($available)
            : array_values(array_filter($configured, function ($value) use ($available) {
                return isset($available[$value]);
            }));
        $options = array_slice($options, 0, 60);

        if ($cacheSeconds > 0 && function_exists('cache')) {
            cache($cacheKey, $options, $cacheSeconds);
        }
        return $options;
    }

    private function facetOptions($name, array $query, array $typeList)
    {
        $fields = ['area' => 'vod_area', 'year' => 'vod_year', 'lang' => 'vod_lang'];
        if (!isset($fields[$name])) {
            return [];
        }
        $facetQuery = $this->facetQuery($query, $name);
        $typeId = intval(isset($query['typeId']) ? $query['typeId'] : 0);
        $cacheSeconds = $this->configInteger(
            'summary_cache_seconds',
            self::DEFAULT_SUMMARY_CACHE_SECONDS,
            0,
            self::MAX_SUMMARY_CACHE_SECONDS
        );
        $cacheKey = 'pingfangapi_facet_' . self::CONTENT_CACHE_VERSION . '_' . $name . '_' . $this->accessCacheKey()
            . '_' . substr(hash('sha256', serialize($facetQuery)), 0, 24);
        if ($cacheSeconds > 0 && function_exists('cache')) {
            $cached = cache($cacheKey);
            if (is_array($cached)) {
                return $cached;
            }
        }

        $configured = $this->configuredFacet($typeId, $typeList, $name);
        if (!empty($configured)) {
            if ($name === 'year') {
                $configured = array_values(array_filter($configured, function ($value) {
                    return preg_match('/^[0-9]{4}$/', $value)
                        && intval($value) >= 1900
                        && intval($value) <= intval(date('Y'));
                }));
                rsort($configured, SORT_STRING);
            }
            return array_slice($configured, 0, 80);
        }
        $builder = $this->baseVodQuery($facetQuery, $typeList);
        if ($this->shouldUsePrimaryScan($facetQuery, $typeList)) {
            $builder = $builder->force('PRIMARY');
        }
        $builder = $builder->where($fields[$name], '<>', '');
        if (!empty($configured)) {
            $builder = $builder->where($fields[$name], 'in', $configured);
        }
        $rows = $builder
            ->field($fields[$name] . ' as value,count(*) as total')
            ->group($fields[$name])
            ->order($name === 'year' ? $fields[$name] . ' desc' : 'total desc')
            ->limit(200)
            ->select();
        $available = [];
        foreach ($this->rows($rows) as $row) {
            foreach ($this->csvValues(isset($row['value']) ? $row['value'] : '') as $value) {
                if ($name === 'year' && (!preg_match('/^[0-9]{4}$/', $value) || intval($value) < 1900 || intval($value) > intval(date('Y')))) {
                    continue;
                }
                $available[$value] = $value;
            }
        }
        $options = empty($configured)
            ? array_values($available)
            : array_values(array_filter($configured, function ($value) use ($available) {
                return isset($available[$value]);
            }));
        if ($name === 'year') {
            rsort($options, SORT_STRING);
        }
        $options = array_slice($options, 0, 80);
        if ($cacheSeconds > 0 && function_exists('cache')) {
            cache($cacheKey, $options, $cacheSeconds);
        }
        return $options;
    }

    protected function facetQuery(array $query, $withoutDimension)
    {
        $filters = [];
        foreach (['typeId', 'area', 'year', 'class', 'lang', 'letter', 'keyword', 'playableOnly', 'scope'] as $name) {
            if ($name !== (string) $withoutDimension && array_key_exists($name, $query)) {
                $filters[$name] = $query[$name];
            }
        }
        return $filters;
    }

    private function configuredClasses($typeId, array $typeList)
    {
        return $this->configuredFacet($typeId, $typeList, 'class');
    }

    private function configuredFacet($typeId, array $typeList, $name)
    {
        $value = '';
        $typeId = intval($typeId);
        if ($typeId > 0 && isset($typeList[$typeId])) {
            $value = $this->typeExtendValue($typeList[$typeId], $name);
            $parentId = intval(isset($typeList[$typeId]['type_pid']) ? $typeList[$typeId]['type_pid'] : 0);
            if ($value === '' && $parentId > 0 && isset($typeList[$parentId])) {
                $value = $this->typeExtendValue($typeList[$parentId], $name);
            }
        }
        if ($value === '') {
            $configKey = 'vod_extend_' . $name;
            $value = isset($GLOBALS['config']['app'][$configKey]) ? $GLOBALS['config']['app'][$configKey] : '';
        }
        return array_slice($this->csvValues($value), 0, 60);
    }

    private function typeExtendValue(array $type, $name)
    {
        $extend = isset($type['type_extend']) ? $type['type_extend'] : [];
        if (is_string($extend)) {
            $decoded = json_decode($extend, true);
            if (!is_array($decoded)) {
                $decoded = @unserialize($extend, ['allowed_classes' => false]);
            }
            $extend = is_array($decoded) ? $decoded : [];
        }
        return is_array($extend) && isset($extend[$name]) ? trim((string) $extend[$name]) : '';
    }

    private function csvValues($value)
    {
        $value = str_replace('，', ',', (string) $value);
        $items = [];
        foreach (explode(',', $value) as $item) {
            $item = trim(strip_tags($item));
            if ($item !== '') {
                $items[$item] = $item;
            }
        }
        return array_values($items);
    }

    private function hotSearch()
    {
        $raw = isset($GLOBALS['config']['app']['search_hot']) ? (string) $GLOBALS['config']['app']['search_hot'] : '';
        $raw = str_replace(['，', "\r", "\n"], [',', '', ''], $raw);
        $items = [];
        foreach (explode(',', $raw) as $word) {
            $word = trim(strip_tags($word));
            if ($word !== '') {
                $items[$word] = $word;
            }
            if (count($items) >= 20) {
                break;
            }
        }

        return array_values($items);
    }

    private function siteName()
    {
        return self::nonEmptyText(
            isset($GLOBALS['config']['site']['site_name']) ? $GLOBALS['config']['site']['site_name'] : '',
            '平方影视'
        );
    }

    private function todayUpdated(array $videos)
    {
        if (class_exists(Db::class)) {
            $cacheSeconds = min(
                self::TODAY_CACHE_SECONDS,
                $this->configInteger('cache_seconds', self::DEFAULT_CACHE_SECONDS, 0, 300)
            );
            $cacheKey = 'pingfangapi_today_updated_' . self::CONTENT_CACHE_VERSION . '_' . date('Ymd') . '_' . $this->accessCacheKey();
            if ($cacheSeconds > 0 && function_exists('cache')) {
                $cached = cache($cacheKey);
                if (is_array($cached) && isset($cached['total'])) {
                    return max(0, intval($cached['total']));
                }
            }

            $builder = $this->applyListAccess(Db::name('Vod')->where([
                'vod_status' => 1,
                'vod_recycle_time' => 0,
            ]));
            $total = max(0, intval($builder
                ->where('vod_time', '>=', strtotime(date('Y-m-d')))
                ->force('vod_time')
                ->count()));
            if ($cacheSeconds > 0 && function_exists('cache')) {
                cache($cacheKey, ['total' => $total], $cacheSeconds);
            }
            return $total;
        }

        $today = date('Y-m-d');
        $count = 0;
        foreach ($videos as $video) {
            if (strpos($video['updated'], $today) === 0) {
                $count++;
            }
        }
        return $count;
    }

    private function contentYear(array $videos)
    {
        $years = [];
        foreach ($videos as $video) {
            if (preg_match('/^\d{4}$/', $video['year'])) {
                $years[] = $video['year'];
            }
        }
        rsort($years, SORT_STRING);

        return isset($years[0]) ? $years[0] : (string) date('Y');
    }

    private function fallbackImage()
    {
        $base = defined('MAC_PATH') ? rtrim((string) MAC_PATH, '/') . '/' : '/';
        return $base . 'template/pingfangvideo/images/brand/lazyload.png';
    }

    private function configInteger($name, $default, $minimum, $maximum)
    {
        $config = function_exists('get_addon_config') ? get_addon_config('pingfangapi') : [];
        $value = is_array($config) && isset($config[$name]) ? intval($config[$name]) : intval($default);
        return max(intval($minimum), min(intval($maximum), $value));
    }

    private function applyListAccess($builder)
    {
        $ids = $this->blockedTypeIds();
        if (!empty($ids)) {
            $builder = $builder->where('type_id', 'not in', $ids);
        }

        return $builder;
    }

    private function blockedTypeIds()
    {
        if ($this->blockedTypeIdsLoaded) {
            return $this->blockedTypeIdsValue;
        }

        $this->blockedTypeIdsLoaded = true;
        if (intval(isset($GLOBALS['config']['app']['popedom_filter']) ? $GLOBALS['config']['app']['popedom_filter'] : 0) !== 1) {
            return $this->blockedTypeIdsValue;
        }
        if (!function_exists('mac_get_popedom_filter')) {
            throw new ApiException(503, 'MacCMS 分类权限服务不可用');
        }

        $groupType = isset($GLOBALS['user']['group']['group_type']) ? (string) $GLOBALS['user']['group']['group_type'] : '';
        $this->blockedTypeIdsValue = array_values(array_unique(array_filter(array_map('intval', explode(',', trim((string) mac_get_popedom_filter($groupType), ', '))), function ($id) {
            return $id > 0;
        })));
        sort($this->blockedTypeIdsValue, SORT_NUMERIC);
        return $this->blockedTypeIdsValue;
    }

    private function assertAccess(array $row, $popedom)
    {
        $typeId = intval(isset($row['type_id']) ? $row['type_id'] : 0);
        $result = call_user_func($this->accessChecker, $typeId, intval($popedom), [], '', $row, 0);
        if (!is_array($result) || intval(isset($result['code']) ? $result['code'] : 0) !== 1) {
            $message = is_array($result) && !empty($result['msg']) ? (string) $result['msg'] : '无权访问该内容';
            throw new ApiException(403, $message);
        }

        if (intval($popedom) === 2) {
            if (intval(isset($row['vod_copyright']) ? $row['vod_copyright'] : 0) === 1
                && intval(isset($GLOBALS['config']['app']['copyright_status']) ? $GLOBALS['config']['app']['copyright_status'] : 0) === 2) {
                throw new ApiException(403, '该内容受版权限制');
            }
            if (trim((string) (isset($row['vod_pwd']) ? $row['vod_pwd'] : '')) !== ''
                && (!function_exists('session') || (string) session('1-1-' . intval($row['vod_id'])) !== '1')) {
                throw new ApiException(403, '该内容需要密码验证');
            }
        }
    }

    private function accessCacheKey()
    {
        $groupId = isset($GLOBALS['user']['group_id']) ? (string) $GLOBALS['user']['group_id'] : '1';
        $groupType = isset($GLOBALS['user']['group']['group_type']) ? (string) $GLOBALS['user']['group']['group_type'] : '';
        $filter = isset($GLOBALS['config']['app']['popedom_filter']) ? (string) $GLOBALS['config']['app']['popedom_filter'] : '0';
        $blockedTypeIds = implode(',', $this->blockedTypeIds());
        return substr(hash('sha256', $groupId . '|' . $groupType . '|' . $filter . '|' . $blockedTypeIds), 0, 16);
    }

    private function rows($value)
    {
        if (is_object($value) && method_exists($value, 'toArray')) {
            $value = $value->toArray();
        }
        return is_array($value) ? $value : [];
    }

    private function row($value)
    {
        if (is_object($value) && method_exists($value, 'toArray')) {
            $value = $value->toArray();
        }
        return is_array($value) ? $value : null;
    }

    private static function resolveCategory($typeId, array $typeList)
    {
        $typeId = intval($typeId);
        $type = isset($typeList[$typeId]) ? $typeList[$typeId] : [];
        $parentId = intval(isset($type['type_pid']) ? $type['type_pid'] : 0);
        if ($parentId > 0 && isset($typeList[$parentId])) {
            $type = $typeList[$parentId];
            $typeId = $parentId;
        }

        return [
            'id' => $typeId > 0 ? $typeId : 1,
            'name' => self::nonEmptyText(isset($type['type_name']) ? $type['type_name'] : '', '其他'),
        ];
    }

    private static function imageUrl($value, $fallback)
    {
        $value = trim((string) $value);
        if ($value !== '' && function_exists('mac_url_img')) {
            $value = trim((string) mac_url_img($value));
        }
        return $value !== '' ? $value : (string) $fallback;
    }

    private static function nonEmptyText($value, $fallback)
    {
        $value = trim(strip_tags((string) $value));
        return $value !== '' ? $value : (string) $fallback;
    }

    private static function plainText($value, $limit)
    {
        $value = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = trim(preg_replace('/\s+/u', ' ', $value));
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, intval($limit), 'UTF-8');
        }
        return substr($value, 0, intval($limit) * 3);
    }

    private static function formatTime($value)
    {
        $timestamp = intval($value);
        return $timestamp > 0 ? date('c', $timestamp) : '1970-01-01T00:00:00+00:00';
    }
}
