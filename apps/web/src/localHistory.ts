export type LocalHistoryEntry = {
  id: string;
  name: string;
  url: string;
  poster?: string;
  progress: string;
  watchedAt: string;
  dateLabel: string;
  timeLabel: string;
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type HistoryInput = {
  id?: string;
  name: string;
  url: string;
  poster?: string;
  progress?: string;
  watchedAt?: string;
};

const storageKeys = ["pingfang_history", "mac_history"] as const;
const safeSegment = "[A-Za-z0-9_~%:-]+";
const cleanWatchPattern = new RegExp(`^/(?:watch|trial)/${safeSegment}/${safeSegment}/${safeSegment}/?$`);
const cleanDetailPattern = new RegExp(`^/vod/${safeSegment}/?$`);
const legacyPlayPattern = new RegExp(`^/index\\.php/vod/play/id/(${safeSegment})/sid/(${safeSegment})/nid/(${safeSegment})(?:\\.html)?/?$`);
const rewritePlayPattern = new RegExp(`^/vodplay/(${safeSegment})-(${safeSegment})-(${safeSegment})(?:\\.html)?/?$`);

function recordValue(record: Record<string, unknown>, nested: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = nested[key] ?? record[key];
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
  }
  return "";
}

function toCleanWatch(match: RegExpMatchArray) {
  return `/watch/${match[1]}/${match[2]}/${match[3]}`;
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => character.charCodeAt(0) < 32);
}

export function normalizeContinueUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || hasControlCharacters(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed, "https://local.invalid");
  } catch {
    return null;
  }

  const path = url.pathname;
  const legacyMatch = path.match(legacyPlayPattern) ?? path.match(rewritePlayPattern);
  if (legacyMatch) return toCleanWatch(legacyMatch);
  if (cleanWatchPattern.test(path) || cleanDetailPattern.test(path)) return path.replace(/\/$/, "") || "/";
  return null;
}

export function normalizePosterUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.includes("\\") || hasControlCharacters(trimmed)) return undefined;

  if (trimmed.startsWith("/")) {
    try {
      return new URL(trimmed, "https://local.invalid").pathname;
    } catch {
      return undefined;
    }
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRecord(value: unknown, index: number): (LocalHistoryEntry & { sortTime: number; sourceIndex: number }) | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? (record.data as Record<string, unknown>) : {};
  const name = recordValue(record, nested, "name", "title");
  const url = normalizeContinueUrl(recordValue(record, nested, "link", "url"));
  if (!name || !url) return null;

  const watchedAt = recordValue(record, nested, "watchedAt", "date", "time");
  const parsedTime = Date.parse(watchedAt);
  const dateLabel = watchedAt.slice(0, 10) || "最近";
  const timeLabel = watchedAt.length >= 16 ? watchedAt.slice(11, 16) : "--:--";

  return {
    id: recordValue(record, nested, "id", "ulog_rid") || url,
    name,
    url,
    poster: normalizePosterUrl(recordValue(record, nested, "pic", "poster", "image")),
    progress: recordValue(record, nested, "progress", "episode") || "继续观看",
    watchedAt,
    dateLabel,
    timeLabel,
    sortTime: Number.isFinite(parsedTime) ? parsedTime : Number.NEGATIVE_INFINITY,
    sourceIndex: index
  };
}

function parseStoredList(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { list?: unknown }).list)) return (parsed as { list: unknown[] }).list;
  } catch {
    // A malformed legacy value is ignored without hiding valid records from the other key.
  }
  return [];
}

export function readLocalHistory(storage: StorageReader): LocalHistoryEntry[] {
  const records: unknown[] = [];
  for (const key of storageKeys) {
    try {
      records.push(...parseStoredList(storage.getItem(key)));
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  const seen = new Set<string>();
  return records
    .map(normalizeRecord)
    .filter((entry): entry is NonNullable<ReturnType<typeof normalizeRecord>> => Boolean(entry))
    .sort((left, right) => right.sortTime - left.sortTime || left.sourceIndex - right.sourceIndex)
    .filter((entry) => {
      const key = entry.id || entry.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50)
    .map(({ sortTime: _sortTime, sourceIndex: _sourceIndex, ...entry }) => entry);
}

export function upsertLocalHistory(storage: StorageWriter, input: HistoryInput): boolean {
  const url = normalizeContinueUrl(input.url);
  const name = input.name.trim();
  if (!name || !url) return false;

  const id = input.id?.trim() || url;
  const next = {
    id,
    name,
    url,
    pic: normalizePosterUrl(input.poster),
    progress: input.progress?.trim() || "继续观看",
    time: input.watchedAt?.trim() || new Date().toISOString()
  };

  try {
    const existing = readLocalHistory(storage)
      .filter((entry) => entry.id !== id && entry.url !== url)
      .map((entry) => ({ id: entry.id, name: entry.name, url: entry.url, pic: entry.poster, progress: entry.progress, time: entry.watchedAt }));
    storage.setItem("pingfang_history", JSON.stringify([next, ...existing].slice(0, 50)));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalHistory(storage: StorageWriter) {
  try {
    storage.removeItem("pingfang_history");
    storage.removeItem("mac_history");
    return true;
  } catch {
    return false;
  }
}
