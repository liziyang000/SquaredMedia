import { describe, expect, it } from "vitest";

import { clearLocalHistory, normalizeContinueUrl, normalizePosterUrl, readLocalHistory, upsertLocalHistory } from "./localHistory";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value))
  } satisfies Storage;
}

describe("local browser history", () => {
  it("allows clean playback routes and converts known MacCMS legacy routes", () => {
    expect(normalizeContinueUrl("/watch/1/2/3")).toBe("/watch/1/2/3");
    expect(normalizeContinueUrl("/index.php/vod/play/id/1/sid/2/nid/3.html")).toBe("/watch/1/2/3");
    expect(normalizeContinueUrl("/vodplay/1-2-3.html")).toBe("/watch/1/2/3");
    expect(normalizeContinueUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeContinueUrl("https://evil.example/watch/1/2/3")).toBeNull();
    expect(normalizeContinueUrl("//evil.example/watch/1/2/3")).toBeNull();
    expect(normalizeContinueUrl("/api.php?action=delete")).toBeNull();
  });

  it("accepts only HTTP image URLs or root-relative image paths", () => {
    expect(normalizePosterUrl("https://img.example/poster.jpg")).toBe("https://img.example/poster.jpg");
    expect(normalizePosterUrl("/upload/poster.jpg?ignored=1")).toBe("/upload/poster.jpg");
    expect(normalizePosterUrl("data:image/svg+xml,bad")).toBeUndefined();
    expect(normalizePosterUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("merges both legacy keys, ignores malformed and unsafe entries, then deduplicates newest first", () => {
    const storage = memoryStorage({
      pingfang_history: JSON.stringify([
        { id: "1", name: "较新记录", url: "/watch/1/1/101", time: "2026-07-21T12:00:00Z" },
        { id: "unsafe", name: "危险记录", url: "javascript:alert(1)" }
      ]),
      mac_history: JSON.stringify({
        list: [
          { data: { id: "2", name: "旧格式记录", link: "/vodplay/2-1-201.html", pic: "/upload/2.jpg" }, date: "2026-07-20 09:10:00" },
          { id: "1", name: "重复记录", url: "/watch/1/1/101", time: "2026-07-19T12:00:00Z" }
        ]
      })
    });

    expect(readLocalHistory(storage)).toEqual([
      expect.objectContaining({ id: "1", name: "较新记录", url: "/watch/1/1/101" }),
      expect.objectContaining({ id: "2", name: "旧格式记录", url: "/watch/2/1/201", poster: "/upload/2.jpg" })
    ]);
  });

  it("upserts a canonical entry and clears both storage keys", () => {
    const storage = memoryStorage();
    expect(
      upsertLocalHistory(storage, {
        id: "1",
        name: "云端回声",
        url: "/watch/1/1/101",
        progress: "正片 · 已看到 1:05",
        watchedAt: "2026-07-21T12:00:00Z"
      })
    ).toBe(true);
    expect(readLocalHistory(storage)).toEqual([expect.objectContaining({ id: "1", name: "云端回声", progress: "正片 · 已看到 1:05", url: "/watch/1/1/101" })]);
    expect(clearLocalHistory(storage)).toBe(true);
    expect(readLocalHistory(storage)).toEqual([]);
  });
});
