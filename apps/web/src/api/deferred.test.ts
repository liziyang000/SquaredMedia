import { describe, expect, it, vi } from "vitest";

import { deferApi } from "./deferred";

describe("deferred API clients", () => {
  it("loads once on demand, forwards arguments and preserves the method owner", async () => {
    const actual = {
      value: 3,
      async read(amount: number) {
        return this.value + amount;
      }
    };
    const load = vi.fn(async () => actual);
    const api = deferApi<Pick<typeof actual, "read">>(load);
    expect(load).not.toHaveBeenCalled();
    expect(await Promise.all([api.read(2), api.read(4)])).toEqual([5, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("retries a failed module load while preserving request errors", async () => {
    const failure = new Error("module unavailable");
    const requestError = new Error("request denied");
    const load = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({
        read: async () => {
          throw requestError;
        }
      });
    const api = deferApi<{ read: () => Promise<void> }>(load);
    await expect(api.read()).rejects.toBe(failure);
    await expect(api.read()).rejects.toBe(requestError);
    await expect(api.read()).rejects.toBe(requestError);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
