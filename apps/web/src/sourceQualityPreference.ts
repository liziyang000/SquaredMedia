import type { ContentEpisode } from "./api/content";
import type { SourceQualityData } from "./api/sourceQuality";

const preferencePrefix = "pingfang_source_quality_preference_v1_";
const preferenceMaxAgeMs = 60_000;
const automaticSwitchKey = "pingfang_automatic_line_switch_v1";
const automaticSwitchMaxAgeMs = 30 * 60_000;
const alternateResumeKey = "pingfang_alternate_playback_resume_v1";
const alternateResumeMaxAgeMs = 30 * 60_000;
const alternateResumeMinimumSeconds = 5;

export type SourceQualityPreference = {
  version: 1;
  vodId: string;
  episodeNo: number;
  recommendedSourceId: string;
  rankedSourceIds: string[];
  expiresAt: number;
};

type PlaybackEpisodeGroup = {
  sourceId: string;
  episodes: ContentEpisode[];
};

function positiveIntegerString(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? String(number) : "";
}

function preferenceKey(vodId: string | number, episodeNo: string | number) {
  const normalizedVodId = positiveIntegerString(vodId);
  const normalizedEpisodeNo = positiveIntegerString(episodeNo);
  return normalizedVodId && normalizedEpisodeNo ? `${preferencePrefix}${normalizedVodId}_${normalizedEpisodeNo}` : "";
}

function readJson(storage: Storage, key: string) {
  try {
    return JSON.parse(storage.getItem(key) || "null") as unknown;
  } catch {
    return null;
  }
}

function remove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage is an optional optimization; playback still works without it.
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is an optional optimization; playback still works without it.
  }
}

export function readSourceQualityPreference(
  storage: Storage,
  vodId: string | number,
  episodeNo: string | number,
  now = Date.now()
): SourceQualityPreference | null {
  const key = preferenceKey(vodId, episodeNo);
  if (!key) return null;
  const value = readJson(storage, key);
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { version?: unknown }).version !== 1 ||
    Number((value as { expiresAt?: unknown }).expiresAt) <= now ||
    !Array.isArray((value as { rankedSourceIds?: unknown }).rankedSourceIds)
  ) {
    remove(storage, key);
    return null;
  }

  const record = value as SourceQualityPreference;
  const requestedVodId = positiveIntegerString(vodId);
  const requestedEpisodeNo = Number(episodeNo);
  const normalizedVodId = positiveIntegerString(record.vodId);
  const episode = Number(record.episodeNo);
  const rankedSourceIds = record.rankedSourceIds.map(positiveIntegerString).filter(Boolean);
  const recommendedSourceId = positiveIntegerString(record.recommendedSourceId);
  if (
    !normalizedVodId ||
    normalizedVodId !== requestedVodId ||
    !Number.isInteger(episode) ||
    episode !== requestedEpisodeNo ||
    episode < 1 ||
    rankedSourceIds.length === 0 ||
    !rankedSourceIds.includes(recommendedSourceId)
  ) {
    remove(storage, key);
    return null;
  }

  return {
    version: 1,
    vodId: normalizedVodId,
    episodeNo: episode,
    recommendedSourceId,
    rankedSourceIds,
    expiresAt: Number(record.expiresAt)
  };
}

export function storeSourceQualityPreference(
  storage: Storage,
  vodId: string | number,
  episodeNo: string | number,
  quality: SourceQualityData,
  now = Date.now()
): SourceQualityPreference | null {
  const key = preferenceKey(vodId, episodeNo);
  if (!key) return null;
  const sources = quality.sources
    .filter((source) => source.available && positiveIntegerString(source.sid))
    .sort((left, right) => {
      const leftRank = left.quality_rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.quality_rank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      if ((left.speed_kbps ?? 0) !== (right.speed_kbps ?? 0)) return (right.speed_kbps ?? 0) - (left.speed_kbps ?? 0);
      return (left.latency_ms ?? Number.MAX_SAFE_INTEGER) - (right.latency_ms ?? Number.MAX_SAFE_INTEGER);
    });
  const rankedSourceIds = sources.map((source) => String(source.sid));
  if (rankedSourceIds.length === 0) {
    remove(storage, key);
    return null;
  }
  const requestedRecommendation = positiveIntegerString(quality.recommended_sid);
  const recommendedSourceId = rankedSourceIds.includes(requestedRecommendation) ? requestedRecommendation : rankedSourceIds[0]!;
  const record: SourceQualityPreference = {
    version: 1,
    vodId: positiveIntegerString(vodId),
    episodeNo: Number(episodeNo),
    recommendedSourceId,
    rankedSourceIds,
    expiresAt: now + preferenceMaxAgeMs
  };
  write(storage, key, record);
  remove(storage, automaticSwitchKey);
  return record;
}

function normalizeEpisodeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

function matchingEpisode(group: PlaybackEpisodeGroup, activeEpisode: ContentEpisode) {
  const byNumber = group.episodes.filter((episode) => episode.no === activeEpisode.no);
  if (byNumber.length === 1) return byNumber[0];
  const activeName = normalizeEpisodeName(activeEpisode.name);
  const byName = group.episodes.filter((episode) => normalizeEpisodeName(episode.name) === activeName);
  return byName.length === 1 ? byName[0] : undefined;
}

type AutomaticSwitchState = {
  version: 1;
  vodId: string;
  episodeNo: number;
  visitedSourceIds: string[];
  expiresAt: number;
};

function readAutomaticSwitchState(storage: Storage, vodId: string, episodeNo: number, now: number): AutomaticSwitchState {
  const value = readJson(storage, automaticSwitchKey);
  if (
    typeof value === "object" &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    (value as { vodId?: unknown }).vodId === vodId &&
    Number((value as { episodeNo?: unknown }).episodeNo) === episodeNo &&
    Number((value as { expiresAt?: unknown }).expiresAt) > now &&
    Array.isArray((value as { visitedSourceIds?: unknown }).visitedSourceIds)
  ) {
    return {
      version: 1,
      vodId,
      episodeNo,
      visitedSourceIds: (value as AutomaticSwitchState).visitedSourceIds.map(positiveIntegerString).filter(Boolean),
      expiresAt: Number((value as AutomaticSwitchState).expiresAt)
    };
  }
  return { version: 1, vodId, episodeNo, visitedSourceIds: [], expiresAt: now + automaticSwitchMaxAgeMs };
}

export function selectAutomaticFallback({
  storage,
  vodId,
  groups,
  activeSourceId,
  activeEpisode,
  now = Date.now()
}: {
  storage: Storage;
  vodId: string;
  groups: PlaybackEpisodeGroup[];
  activeSourceId: string;
  activeEpisode: ContentEpisode;
  now?: number;
}): ContentEpisode | null {
  if (groups.length < 2) return null;
  const currentIndex = groups.findIndex((group) => group.sourceId === activeSourceId);
  if (currentIndex < 0) return null;
  const candidates = groups
    .slice(currentIndex + 1)
    .concat(groups.slice(0, currentIndex))
    .map((group, order) => ({ group, episode: matchingEpisode(group, activeEpisode), order }))
    .filter((candidate): candidate is { group: PlaybackEpisodeGroup; episode: ContentEpisode; order: number } => Boolean(candidate.episode));
  const preference = readSourceQualityPreference(storage, vodId, activeEpisode.no, now);
  if (preference) {
    const rank = new Map(preference.rankedSourceIds.map((sourceId, index) => [sourceId, index]));
    candidates.splice(
      0,
      candidates.length,
      ...candidates
        .filter((candidate) => rank.has(candidate.group.sourceId))
        .sort(
          (left, right) =>
            (rank.get(left.group.sourceId) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.group.sourceId) ?? Number.MAX_SAFE_INTEGER) || left.order - right.order
        )
    );
  }

  const state = readAutomaticSwitchState(storage, vodId, activeEpisode.no, now);
  if (!state.visitedSourceIds.includes(activeSourceId)) state.visitedSourceIds.push(activeSourceId);
  const candidate = candidates.find(({ group }) => !state.visitedSourceIds.includes(group.sourceId));
  if (!candidate) return null;
  state.visitedSourceIds.push(candidate.group.sourceId);
  state.expiresAt = now + automaticSwitchMaxAgeMs;
  write(storage, automaticSwitchKey, state);
  return candidate.episode;
}

export function storeAlternatePlaybackResume(storage: Storage, target: string, seconds: number, now = Date.now()) {
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\") || !Number.isFinite(seconds) || seconds < alternateResumeMinimumSeconds) {
    remove(storage, alternateResumeKey);
    return;
  }
  write(storage, alternateResumeKey, {
    version: 1,
    target,
    seconds: Math.round(seconds * 10) / 10,
    expiresAt: now + alternateResumeMaxAgeMs
  });
}

export function consumeAlternatePlaybackResume(storage: Storage, target: string, now = Date.now()) {
  const value = readJson(storage, alternateResumeKey);
  remove(storage, alternateResumeKey);
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { version?: unknown }).version !== 1 ||
    (value as { target?: unknown }).target !== target ||
    Number((value as { expiresAt?: unknown }).expiresAt) <= now
  ) {
    return 0;
  }
  const seconds = Number((value as { seconds?: unknown }).seconds);
  return Number.isFinite(seconds) && seconds >= alternateResumeMinimumSeconds ? seconds : 0;
}
