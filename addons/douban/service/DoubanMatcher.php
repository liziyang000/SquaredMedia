<?php

namespace addons\douban\service;

class DoubanMatcher
{
    public static function rank(array $vod, array $candidates, int $threshold = 85): array
    {
        $vodTitle = self::normalizeTitle((string) ($vod['vod_name'] ?? ''));
        $vodYear = trim((string) ($vod['vod_year'] ?? ''));
        $ranked = [];

        foreach ($candidates as $candidate) {
            if (!is_array($candidate)) {
                continue;
            }
            $candidateTitle = self::normalizeTitle((string) ($candidate['title'] ?? ''));
            $candidateYear = trim((string) ($candidate['year'] ?? ''));
            $titleScore = 0;
            if ($vodTitle !== '' && $candidateTitle === $vodTitle) {
                $titleScore = 75;
            } elseif ($vodTitle !== '' && $candidateTitle !== '' && (str_contains($candidateTitle, $vodTitle) || str_contains($vodTitle, $candidateTitle))) {
                $titleScore = 50;
            }
            $yearScore = $vodYear !== '' && $candidateYear === $vodYear ? 25 : 0;
            $candidate['score_total'] = $titleScore + $yearScore;
            $candidate['score_detail'] = ['title' => $titleScore, 'year' => $yearScore];
            $candidate['conflicts'] = $vodYear !== '' && $candidateYear !== '' && $candidateYear !== $vodYear ? ['year'] : [];
            $ranked[] = $candidate;
        }

        usort($ranked, function (array $left, array $right): int {
            return (int) $right['score_total'] <=> (int) $left['score_total'];
        });

        $topScore = (int) ($ranked[0]['score_total'] ?? 0);
        $secondScore = (int) ($ranked[1]['score_total'] ?? -1);

        return [
            'auto_confirm' => $topScore >= max(0, min(100, $threshold)) && $topScore > $secondScore,
            'candidates' => $ranked,
        ];
    }

    private static function normalizeTitle(string $value): string
    {
        $value = mb_strtolower(trim($value), 'UTF-8');

        return preg_replace('/[\p{P}\p{S}\s]+/u', '', $value);
    }
}
