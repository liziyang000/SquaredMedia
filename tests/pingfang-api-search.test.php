<?php
declare(strict_types=1);

namespace think {
    final class Db {
        public static function name($table) { if ($table !== 'Vod') { throw new \RuntimeException('Unexpected table'); } return new \SearchQuery(); }
        public static function query($sql, $bind = []) {
            if (strpos($sql, 'SHOW INDEX') === 0) { return $GLOBALS['searchIndexes'] ?? []; }
            $GLOBALS['searchIdReads'] = ($GLOBALS['searchIdReads'] ?? 0) + 1;
            $sql = preg_replace('/ FORCE INDEX \([a-z_]+\)/', '', str_replace('`mac_vod`', 'Vod', $sql));
            $sql = preg_replace('/LIKE (:[a-z]+)/', "LIKE $1 ESCAPE '\\'", $sql);
            $statement = $GLOBALS['searchDatabase']->prepare($sql); $statement->execute($bind);
            return $statement->fetchAll(\PDO::FETCH_ASSOC);
        }
    }
}
namespace {
    require_once dirname(__DIR__) . '/addons/pingfangapi/service/ApiException.php';
    require_once dirname(__DIR__) . '/addons/pingfangapi/service/ContentService.php';
    final class SearchQuery {
        public array $parts = [];
        public array $values = [];
        public function getTable() { return 'mac_vod'; }
        public function where($field, $operator = null, $value = null) {
            if (is_callable($field)) { $group = new self(); $field($group); $this->parts[] = ['AND', '(' . $group->sql() . ')']; $this->values = array_merge($this->values, $group->values); return $this; }
            if (is_array($field)) { foreach ($field as $key => $item) { $this->where($key, '=', $item); } return $this; }
            return $this->add('AND', $field, func_num_args() === 2 ? '=' : $operator, func_num_args() === 2 ? $operator : $value);
        }
        public function whereOr($field, $operator, $value) { return $this->add('OR', $field, $operator, $value); }
        private function add($join, $field, $operator, $value) {
            if ($operator === 'in' || $operator === 'not in') { $this->parts[] = [$join, $field . ' ' . strtoupper($operator) . ' (' . implode(',', array_fill(0, count($value), '?')) . ')']; $this->values = array_merge($this->values, $value); return $this; }
            $this->parts[] = [$join, $field . ' ' . $operator . " ?" . ($operator === 'like' ? " ESCAPE '\\'" : '')]; $this->values[] = $value; return $this;
        }
        private function sql() { return implode(' ', array_map(static fn($part, $index) => ($index ? $part[0] . ' ' : '') . $part[1], $this->parts, array_keys($this->parts))); }
        public function ids() { $statement = $GLOBALS['searchDatabase']->prepare('SELECT vod_id FROM Vod WHERE ' . $this->sql() . ' ORDER BY vod_id'); $statement->execute($this->values); return $statement->fetchAll(\PDO::FETCH_COLUMN); }
    }
    function mac_get_popedom_filter($group = '') { return $GLOBALS['blockedSearchTypes'] ?? ''; }
    $db = new \PDO('sqlite::memory:'); $GLOBALS['searchDatabase'] = $db;
    $db->exec('CREATE TABLE Vod (vod_id INTEGER, vod_status INTEGER, vod_recycle_time INTEGER, vod_name TEXT, vod_sub TEXT, vod_actor TEXT, vod_director TEXT, vod_year TEXT)');
    $insert = $db->prepare('INSERT INTO Vod VALUES (?, ?, 0, ?, ?, ?, ?, ?)');
    foreach ([[1,1,'海边日记','','演员甲','导演甲','2024'],[2,1,'另一个故事','海边日记','演员乙','导演乙','2023'],[3,0,'海边日记未上架','','','','2024'],[4,1,'日记开头','','','','2024'],[5,1,'城市100%日记','','','','2024'],[6,1,'城市100X日记','','','','2024'],[7,1,'无关影片','','某人,日记演员','','2024']] as $row) { $insert->execute($row); }
    $method = new \ReflectionMethod(\addons\pingfangapi\service\ContentService::class, 'baseVodQuery');
    $service = new \addons\pingfangapi\service\ContentService(static function () {});
    $find = static fn($query) => $method->invoke($service, $query, [])->ids();
    $assert = static function ($actual, $expected, $message) { if ($actual !== $expected) { throw new \RuntimeException($message . ': ' . json_encode($actual)); } };
    $assert($find(['keyword'=>'日记']), [4], 'Existing clients retain prefix matching');
    $assert($find(['keyword'=>'日记','searchMode'=>'contains']), [1,2,4,5,6], 'Title fragments and aliases match; hidden films and infix actor scans are excluded');
    $assert($find(['keyword'=>'日记','searchMode'=>'contains','year'=>'2024']), [1,4,5,6], 'Filters still constrain the entire search group');
    $assert($find(['keyword'=>'100%','searchMode'=>'contains']), [5], 'Percent signs are literal user input, not wildcards');
    $assert($find(['keyword'=>'边','searchMode'=>'contains']), [], 'Single-character queries keep the bounded prefix behavior');
    $assert($find(['keyword'=>'']), [], 'An empty explicit search cannot match everything');
    foreach (['idx_pfapi_search_name'=>'vod_name', 'idx_pfapi_search_sub'=>'vod_sub'] as $name=>$field) {
        foreach ([$field,'vod_id'] as $index=>$column) { $GLOBALS['searchIndexes'][] = ['Key_name'=>$name,'Seq_in_index'=>$index+1,'Column_name'=>$column,'Sub_part'=>null,'Visible'=>'YES','Index_type'=>'BTREE']; }
    }
    $service = new \addons\pingfangapi\service\ContentService(static function () {});
    $fast = static fn($query) => $method->invoke($service, $query, [])->ids();
    $assert($fast(['keyword'=>'日记','searchMode'=>'contains']), [1,2,4,5,6], 'Indexed matching preserves titles, aliases, deduplication and visibility');
    $assert($fast(['keyword'=>'日记','searchMode'=>'contains','year'=>'2024']), [1,4,5,6], 'Indexed candidates still obey filters');
    $assert($GLOBALS['searchIdReads'], 1, 'Counts and facets within a request reuse one candidate query');
    $assert($fast(['keyword'=>'100%','searchMode'=>'contains']), [5], 'Indexed percent signs remain literal');
    $assert($fast(['keyword'=>"x' OR 1=1 --",'searchMode'=>'contains']), [], 'Indexed search binds user input');
    $assert($fast(['keyword'=>'不存在','searchMode'=>'contains']), [], 'No candidates cannot remove the search constraint');
    $assert($fast(['keyword'=>'日记']), [4], 'Prefix matching remains unchanged with covering indexes');
    $db->exec('ALTER TABLE Vod ADD COLUMN type_id INTEGER DEFAULT 0');
    $db->exec('UPDATE Vod SET type_id=99 WHERE vod_id=1');
    $GLOBALS['config']['app']['popedom_filter'] = 1; $GLOBALS['blockedSearchTypes'] = '99';
    $restricted = new \addons\pingfangapi\service\ContentService(static function () {});
    $assert($method->invoke($restricted, ['keyword'=>'日记','searchMode'=>'contains'], [])->ids(), [2,4,5,6], 'Indexed candidates never bypass category access restrictions');
    $GLOBALS['config']['app']['popedom_filter'] = 0;
    $GLOBALS['searchIndexes'][0]['Sub_part'] = 20;
    $fallback = new \addons\pingfangapi\service\ContentService(static function () {});
    $reads = $GLOBALS['searchIdReads'];
    $assert($method->invoke($fallback, ['keyword'=>'日记','searchMode'=>'contains'], [])->ids(), [1,2,4,5,6], 'An incompatible index uses the original complete search');
    $assert($GLOBALS['searchIdReads'], $reads, 'Partial indexes must not activate the covering query');
    echo "Pingfang API title-fragment search tests passed.\n";
}
