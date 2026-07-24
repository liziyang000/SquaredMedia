import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const originalReleaseId = process.env.SQUAREDMEDIA_RELEASE_ID;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalReleaseId === undefined) {
    delete process.env.SQUAREDMEDIA_RELEASE_ID;
  } else {
    process.env.SQUAREDMEDIA_RELEASE_ID = originalReleaseId;
  }
});

describe("healthz", () => {
  it("reports the running release without probing upstream services", async () => {
    process.env.SQUAREDMEDIA_RELEASE_ID = "20260724T120000Z-abcdef123456";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      release: "20260724T120000Z-abcdef123456"
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
