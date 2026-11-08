<?php
namespace think {
    class Db {
        public static function name($name) { return new \SearchQuery(); }
    }
}

namespace app\common\model {
    class Base {
        private $key;
        public function where($where) { $this->key = $where['search_key']; return $this; }
        public function field($field) { return $this; }
        public function find() {
            $path = RUNTIME_PATH . $this->key . '.json';
            return is_file($path) ? json_decode(file_get_contents($path), true) : null;
        }
        public function insert($row) {
            $path = RUNTIME_PATH . $row['search_key'] . '.json';
            $tmp = $path . '.' . getmypid();
            file_put_contents($tmp, json_encode($row));
            rename($tmp, $path);
        }
        public function update($values) {
            $row = $this->find();
            $this->insert(array_merge($row, $values));
        }
    }
}

namespace {
    class SearchQuery {
        private $word;
        public function where($field, $value = null) {
            if (is_array($field)) {
                $this->word = trim(reset($field)[1], '%');
            }
            return $this;
        }
        public function order($order) { return $this; }
        public function column($field) {
            file_put_contents(RUNTIME_PATH . 'scans', $this->word . "\n", FILE_APPEND | LOCK_EX);
            usleep(300000);
            if (getenv('SEARCH_TEST_FAIL') === '1') {
                throw new \RuntimeException('simulated database failure');
            }
            return $this->word === '无结果' ? [] : ($this->word === '乙' ? [2, 3] : [1, 2]);
        }
    }

    if (($argv[1] ?? '') === '--worker') {
        define('RUNTIME_PATH', $argv[3] . '/');
        require $argv[2];
        while (!is_file(RUNTIME_PATH . 'start')) { usleep(1000); }
        $model = new \app\common\model\VodSearch();
        $ids = $model->getResultIdList($argv[4], $argv[5], $argv[6] === '1');
        $again = $model->getResultIdList($argv[4], $argv[5], $argv[6] === '1');
        if ($ids !== $again) { throw new \RuntimeException('request memo changed results'); }
        echo json_encode($ids);
        exit;
    }

    $source = realpath($argv[1] ?? '');
    if (!$source || !is_file($source)) {
        fwrite(STDERR, "Usage: php tests/search-cache.test.php /path/to/VodSearch.php\n");
        exit(2);
    }
    $dir = sys_get_temp_dir() . '/pfv-search-test-' . bin2hex(random_bytes(6));
    mkdir($dir);
    $run = function ($word, $field = 'vod_name|vod_en|vod_sub', $count = 1, $multiple = false, $fail = false) use ($source, $dir) {
        unlink($dir . '/start');
        $workers = [];
        for ($i = 0; $i < $count; $i++) {
            $pipes = [];
            $process = proc_open([PHP_BINARY, __FILE__, '--worker', $source, $dir, $word, $field, $multiple ? '1' : '0'],
                [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null,
                array_merge(getenv(), ['SEARCH_TEST_FAIL' => $fail ? '1' : '0']));
            fclose($pipes[0]);
            $workers[] = [$process, $pipes];
        }
        touch($dir . '/start');
        $results = [];
        foreach ($workers as [$process, $pipes]) {
            $output = stream_get_contents($pipes[1]);
            $error = stream_get_contents($pipes[2]);
            fclose($pipes[1]); fclose($pipes[2]);
            $status = proc_close($process);
            if (($status === 0) === $fail) { throw new \RuntimeException($error ?: 'unexpected worker status'); }
            $results[] = json_decode($output, true);
        }
        return $results;
    };
    $check = function ($actual, $expected, $message) {
        if ($actual !== $expected) { throw new \RuntimeException($message . ': ' . json_encode($actual)); }
    };
    $scanCount = function () use ($dir) { return count(file($dir . '/scans', FILE_IGNORE_NEW_LINES)); };
    touch($dir . '/start');
    try {
        $check($run('  甲  ', 'vod_name|vod_en|vod_sub', 4), array_fill(0, 4, [1, 2]), 'concurrent result mismatch');
        $check($scanCount(), 1, 'same cold key must scan once across four PHP processes');
        $check($run('甲'), [[1, 2]], 'warm result mismatch');
        $check($scanCount(), 1, 'warm cache must not scan');
        $check($run('甲', 'vod_actor'), [[1, 2]], 'field-specific result mismatch');
        $check($scanCount(), 2, 'different search fields must retain separate keys');
        $check($run('无结果', 'vod_name', 3), [[0], [0], [0]], 'empty cache sentinel changed');
        $check($scanCount(), 3, 'empty result must also coalesce');
        $check($run('甲,乙', 'vod_name', 1, true), [[1, 2, 3]], 'multi-word union changed');
        $check($scanCount(), 5, 'multi-word memo must avoid repeated scans');
        $run('失败恢复', 'vod_name', 1, false, true);
        $check($run('失败恢复', 'vod_name'), [[1, 2]], 'failed query must release the lock');
        echo "Search cache: concurrent misses, warm/empty hits, field keys, multi-word memo and failure release passed.\n";
    } finally {
        foreach (glob($dir . '/*') as $path) { unlink($path); }
        rmdir($dir);
    }
}
