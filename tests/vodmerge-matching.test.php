<?php

require_once dirname(__DIR__) . '/addons/vodmerge/bootstrap.php';

use addons\vodmerge\service\Payload;

(static function () {
    $count = 0;
    $assert = static function ($condition, string $message) use (&$count): void {
        $count++;
        if (function_exists('check')) {
            check($condition, $message);
        } elseif (!$condition) {
            throw new RuntimeException($message);
        }
    };

    foreach (['示例剧第１２季', '示例剧第十二季', '示例剧S12', '示例剧Season １２', 'Example S12'] as $title) {
        $assert(Payload::season($title) === '12', 'Explicit Chinese/English/fullwidth seasons: ' . $title);
    }
    $assert(Payload::season('AS02') === '', 'English word suffix is not a season marker');
    $assert(Payload::season('Example Season 20th') === '', 'Season marker requires a complete number');
    $assert(Payload::seasons(['vod_name' => '示例剧 S02', 'vod_sub' => '另一译名 第二季/原名第２季']) === ['2'], 'Repeated season evidence is deduplicated');
    $assert(Payload::seasons(['vod_name' => '示例剧 S12', 'vod_sub' => '第二季/第十季']) === ['2', '10', '12'], 'All explicit seasons are retained in stable order');
    $assert(Payload::season('示例剧 第一季/第二季') === '', 'Ambiguous title has no single season');
    $assert(Payload::seasons(['vod_name' => '示例剧', 'vod_en' => 'exampleS02']) === [], 'Pinyin/English slug is not season identity evidence');

    $left = ['vod_name' => '示例剧', 'vod_sub' => '第二季'];
    $right = ['vod_name' => '示例剧 第一季'];
    $assert(in_array('季数冲突', Payload::conflicts($left, $right), true), 'Season found only in subtitle still blocks wrong-season merge');
    $assert(Payload::conflicts(['vod_name' => '示例剧 第一季', 'vod_sub' => '第二季'], $right) !== [], 'Contradictory evidence within one record blocks merge');
    $assert(Payload::conflicts(['vod_name' => '示例剧 第１季'], $right) === [], 'Equivalent season spellings do not conflict');
    $identity = Payload::identity(['vod_name' => 'Example Season 2']);
    $assert($identity['seasons'] === ['2'], 'Binding stores explicit season evidence before title normalization');
    $assert(in_array('季数冲突', Payload::conflicts($identity, Payload::identity(['vod_name' => 'Example Season 3'])), true), 'Normalized identity still detects English season conflict');
    $assert(Payload::identity($left) !== Payload::identity(array_merge($left, ['vod_sub' => '第三季'])), 'Subtitle season change invalidates automatic binding identity');
    $oldIdentity = $identity;
    unset($oldIdentity['seasons']);
    $assert($oldIdentity !== $identity, 'Legacy binding without season evidence requires manual refresh');
    $assert(Payload::conflicts($oldIdentity, $identity) === [], 'Legacy binding still permits manual reconfirmation');

    $terms = Payload::searchTitles(['vod_name' => '山海 第十二季', 'vod_sub' => '异名第一季 / 另一个名字；第三译名', 'vod_en' => 'English Title']);
    foreach (['山海 第十二季', '异名第一季', '另一个名字', '第三译名', 'English Title', '山海', '异名'] as $term) {
        $assert(in_array($term, $terms, true), 'Recall includes complete title, split alias and stem: ' . $term);
    }
    $assert(Payload::searchTitles(['vod_name' => '示例剧', 'vod_sub' => '示例剧/示例剧']) === ['示例剧'], 'Recall terms are deduplicated');
    $assert(count(Payload::searchTitles(['vod_name' => '示例剧', 'vod_sub' => implode('/', array_map(static function ($n) { return '别名' . $n; }, range(1, 20)))])) === 8, 'Recall is bounded to eight terms');
    $assert(in_array('示例剧', Payload::searchTitles(['vod_name' => '示例剧第２季']), true), 'Fullwidth season is removed from recall stem');
    $assert(Payload::searchTitles(['vod_name' => '示例剧第２季'], false) === ['示例剧第２季'], 'Complete recall terms are available separately from weaker stems');
    $manyAliases = ['vod_name' => '山海 第二季', 'vod_en' => 'Star Voyage Season 2',
        'vod_sub' => implode('/', array_map(static function ($n) { return '别名' . $n . ' 第二季'; }, range(1, 20)))];
    $fullTerms = Payload::searchTitles($manyAliases, false);
    $allTerms = Payload::searchTitles($manyAliases);
    $assert(count($fullTerms) === 8 && count($allTerms) === 16, 'Eight complete titles and eight season stems have independent bounded budgets');
    $assert($fullTerms[0] === '山海 第二季' && $fullTerms[1] === 'Star Voyage Season 2', 'Primary and English titles retain priority ahead of numerous aliases');
    $assert(in_array('山海', $allTerms, true) && in_array('Star Voyage', $allTerms, true), 'Alias saturation cannot remove primary or English season stems');
    $assert(in_array('星河', Payload::searchTitles(['vod_name' => '星河· 第二季']), true), 'Season stems trim trailing punctuation as well as whitespace');
    $assert(Payload::searchTitles(['vod_name' => '上']) === ['上'], 'A one-character complete title remains available for exact lookup');
    $assert(Payload::searchTitles(['vod_name' => '上 第二季']) === ['上 第二季'], 'A one-character season stem cannot widen recall');

    $video = ['vod_name' => '示例剧 第一季', 'vod_sub' => '', 'vod_year' => '2026', 'vod_douban_id' => 10001,
        'type_id' => 2, 'vod_version' => '', 'vod_actor' => '未知，林山 / 江海', 'vod_director' => ''];
    $assert(Payload::automaticIssues($video, $video) === [], 'Complete consistent positive evidence permits automatic match policy');
    $assert(Payload::automaticIssues($video, array_merge($video, ['vod_name' => '另一译名 第一季', 'vod_sub' => '示例剧 第一季/其他'])) === [], 'A complete shared alias supplies positive title evidence');
    foreach (['示例剧 Season 1', '示例剧 第1季', '示例剧 第１季', '示例剧S01'] as $title) {
        $assert(Payload::automaticIssues($video, array_merge($video, ['vod_name' => $title])) === [], 'Equivalent explicit season spelling preserves full-title evidence: ' . $title);
    }
    foreach (['示例剧', '示例剧 第一季 剧场版', '示例剧 第一季 特别篇', '示例剧 第一季 导演剪辑版', '另一部示例剧 第一季'] as $title) {
        $assert(Payload::automaticIssues($video, array_merge($video, ['vod_name' => $title])) !== [], 'Season normalization preserves all other title content: ' . $title);
    }
    $assert(Payload::automaticIssues(array_merge($video, ['vod_en' => 'same']), array_merge($video, ['vod_name' => '另一作品 第一季', 'vod_en' => 'same'])) !== [], 'Matching vod_en cannot authorize first binding');
    foreach (['vod_douban_id' => 0, 'type_id' => 0, 'vod_year' => '', 'vod_version' => '导演剪辑版', 'vod_name' => '示例剧'] as $field => $value) {
        $assert(Payload::automaticIssues($video, array_merge($video, [$field => $value])) !== [], 'Missing or asymmetric identity evidence blocks automatic match: ' . $field);
    }
    foreach (['0000', '202', '2026年', 'unknown'] as $year) {
        $invalidYear = array_merge($video, ['vod_year' => $year]);
        $assert(Payload::automaticIssues($invalidYear, $invalidYear) !== [], 'Invalid year cannot count as matching positive evidence');
    }
    foreach (['未知', '内详', 'N/A', 'Unknown', '不详/暂无', '待更新', '12345'] as $name) {
        $unknownPeople = array_merge($video, ['vod_actor' => $name]);
        $assert(Payload::automaticIssues($unknownPeople, $unknownPeople) !== [], 'Placeholder cannot count as a shared person: ' . $name);
    }
    $director = array_merge($video, ['vod_actor' => '', 'vod_director' => '顾风']);
    $assert(Payload::automaticIssues($director, $director) === [], 'A shared explicit director is sufficient people evidence');
    $assert(Payload::automaticIssues($director, array_merge($video, ['vod_actor' => '顾风'])) !== [], 'Actor/director role mismatch is not shared people evidence');
    $ambiguous = array_merge($video, ['vod_sub' => '第二季']);
    $assert(Payload::automaticIssues($ambiguous, $ambiguous) !== [], 'Matching internally ambiguous season sets still block automatic match');
    $seasonOnlyAlias = array_merge($video, ['vod_sub' => '第一季/Season 1/S01']);
    $unrelatedAlias = array_merge($seasonOnlyAlias, ['vod_name' => '完全不同作品 第一季']);
    $assert(Payload::automaticIssues($seasonOnlyAlias, $unrelatedAlias) !== [], 'Shared season-only aliases are not positive full-title evidence');
    $emptyTitles = array_merge($video, ['vod_name' => '---']);
    $assert(Payload::automaticIssues($emptyTitles, $emptyTitles) !== [], 'Punctuation-only titles are not positive evidence');
    echo "VodMerge matching tests passed: $count assertions.\n";
})();
