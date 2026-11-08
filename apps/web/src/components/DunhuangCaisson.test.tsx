import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DunhuangCaisson } from "./DunhuangCaisson";

const shape = () => ({
  rotation: 0,
  scale: 1,
  opacity: 1,
  fill: "",
  stroke: "",
  linewidth: 1,
  translation: { set: vi.fn() },
  add: vi.fn(),
  noFill: vi.fn(),
  noStroke: vi.fn()
});
class MockTwo {
  static Types = { svg: "svg" };
  static Instances: MockTwo[] = [];
  renderer = { domElement: document.createElementNS("http://www.w3.org/2000/svg", "svg") };
  constructor() {
    MockTwo.Instances.push(this);
  }
  appendTo(element: HTMLElement) {
    element.appendChild(this.renderer.domElement);
    return this;
  }
  makeGroup = shape;
  makeCircle = shape;
  makeEllipse = shape;
  makeStar = shape;
  makePolygon = shape;
  update = vi.fn();
  pause = vi.fn();
  release = vi.fn();
  clear = vi.fn();
}

describe("DunhuangCaisson lifecycle", () => {
  let frames: Map<number, FrameRequestCallback>;
  let reduced: boolean;
  let nextFrame: number;
  const tick = (time: number) => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
  };
  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    reduced = false;
    MockTwo.Instances = [];
    (window as Window & { Two?: unknown }).Two = MockTwo;
    delete document.documentElement.dataset.theme;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frames.set(++nextFrame, callback);
        return nextFrame;
      })
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        frames.delete(id);
      })
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        get matches() {
          return reduced;
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    );
  });
  afterEach(() => {
    cleanup();
    document.querySelectorAll("[data-dunhuang-runtime]").forEach((script) => {
      script.dispatchEvent(new Event("error"));
      script.remove();
    });
    delete (window as Window & { Two?: unknown }).Two;
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it("does not load a renderer on other themes or reduced motion", () => {
    const first = render(<DunhuangCaisson />);
    expect(MockTwo.Instances).toHaveLength(0);
    first.unmount();
    document.documentElement.dataset.theme = "dunhuang-caisson";
    reduced = true;
    render(<DunhuangCaisson />);
    expect(MockTwo.Instances).toHaveLength(0);
    expect(document.querySelector("[data-dunhuang-runtime]")).toBeNull();
  });

  it("finishes after 4.2 seconds and releases the renderer when the theme changes", async () => {
    document.documentElement.dataset.theme = "dunhuang-caisson";
    const { container } = render(<DunhuangCaisson />);
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
    const instance = MockTwo.Instances[0];
    act(() => {
      tick(0);
      tick(4200);
    });
    expect(instance.update).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
    await act(async () => {
      document.documentElement.dataset.theme = "ink-wash";
    });
    expect(container.querySelector("svg")).toBeNull();
    expect(MockTwo.Instances).toHaveLength(0);
    expect(instance.release).toHaveBeenCalledOnce();
  });

  it("cancels frames and removes renderer references on unmount", async () => {
    document.documentElement.dataset.theme = "dunhuang-caisson";
    const view = render(<DunhuangCaisson />);
    await waitFor(() => expect(MockTwo.Instances).toHaveLength(1));
    const instance = MockTwo.Instances[0];
    view.unmount();
    expect(frames.size).toBe(0);
    expect(MockTwo.Instances).toHaveLength(0);
    expect(instance.pause).toHaveBeenCalledOnce();
    expect(instance.clear).toHaveBeenCalledOnce();
  });

  it("does not attach a late runtime after navigating away", async () => {
    delete (window as Window & { Two?: unknown }).Two;
    document.documentElement.dataset.theme = "dunhuang-caisson";
    const view = render(<DunhuangCaisson />);
    const script = document.querySelector("[data-dunhuang-runtime]")!;
    view.unmount();
    (window as Window & { Two?: unknown }).Two = MockTwo;
    await act(async () => {
      script.dispatchEvent(new Event("load"));
    });
    expect(MockTwo.Instances).toHaveLength(0);
  });
});
