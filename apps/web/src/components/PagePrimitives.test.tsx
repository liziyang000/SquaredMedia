import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TestRoutingProvider } from "../app/routing";
import { Artwork, ScoreBadge, VodCard } from "./PagePrimitives";

describe("Artwork", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clears the loading state on load, failure, and source replacement", () => {
    const { container, rerender } = render(<Artwork containerClassName="home-shelf-poster" src="/first.jpg" alt="海报" />);
    expect(container.firstElementChild).toHaveClass("is-image-loading");
    fireEvent.load(screen.getByRole("img", { name: "海报" }));
    expect(container.firstElementChild).not.toHaveClass("is-image-loading");
    rerender(<Artwork containerClassName="home-shelf-poster" src="/second.jpg" alt="海报" />);
    expect(container.firstElementChild).toHaveClass("is-image-loading");
    fireEvent.error(screen.getByRole("img", { name: "海报" }));
    expect(container.firstElementChild).toHaveClass("is-image-missing");
    expect(container.firstElementChild).not.toHaveClass("is-image-loading");
  });

  it("does not keep a loading overlay on an image already loaded before hydration", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(300);
    const { container } = render(<Artwork containerClassName="home-shelf-poster" src="/cached.jpg" alt="海报" />);
    expect(container.firstElementChild).not.toHaveClass("is-image-loading", "is-image-missing");
  });

  it("shows the missing state when an image failed before hydration", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    const { container } = render(<Artwork containerClassName="home-shelf-poster" src="/broken.jpg" alt="海报" />);
    expect(container.firstElementChild).toHaveClass("is-image-missing");
    expect(container.firstElementChild).not.toHaveClass("is-image-loading");
  });

  it("renders a placeholder when the source is empty", () => {
    const { container } = render(<Artwork containerClassName="poster" src="" alt="空海报" />);

    expect(screen.queryByRole("img", { name: "空海报" })).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("poster", "is-image-missing");
    expect(container.firstElementChild).toHaveAttribute("data-artwork");
  });

  it("falls back after an image error and retries when the source changes", async () => {
    const { container, rerender } = render(<Artwork containerClassName="poster" src="/broken.jpg" alt="影片海报" />);

    fireEvent.error(screen.getByRole("img", { name: "影片海报" }));
    expect(screen.queryByRole("img", { name: "影片海报" })).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("is-image-missing");

    rerender(<Artwork containerClassName="poster" src="/working.jpg" alt="影片海报" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "影片海报" })).toHaveAttribute("src", "/working.jpg"));
    expect(container.firstElementChild).not.toHaveClass("is-image-missing");
  });
});

describe("VodCard", () => {
  afterEach(cleanup);

  it("keeps the legacy score and update badges inside the poster", () => {
    const { container } = render(
      <TestRoutingProvider href="/rankings/yearly">
        <VodCard
          video={{
            id: "1",
            title: "测试影片",
            poster: "/poster.jpg",
            remark: "更新至第9集",
            year: "2026",
            class: "剧情,悬疑",
            typeName: "国产剧",
            score: 8.6
          }}
        />
      </TestRoutingProvider>
    );

    const poster = container.querySelector(".vod-card .poster");
    expect(poster?.querySelector(".quality-badge")).toHaveTextContent("更新至第9集");
    expect(poster?.querySelector(".score-badge")).toHaveTextContent("8.6");
    expect(container.querySelector(".vod-card > .score-badge")).not.toBeInTheDocument();
    expect(Array.from(container.querySelectorAll(".card-meta span")).map((node) => node.textContent)).toEqual(["国产剧", "2026"]);

    fireEvent.error(screen.getByRole("img", { name: "测试影片" }));
    expect(poster).toHaveClass("is-image-missing");
    expect(poster?.querySelector(".quality-badge")).toHaveTextContent("更新至第9集");
    expect(poster?.querySelector(".score-badge")).toHaveTextContent("8.6");
  });
});

describe("ScoreBadge", () => {
  afterEach(cleanup);
  it.each([0, 0.01, 10.1, Number.NaN, Number.POSITIVE_INFINITY])("hides invalid or absent score %s", (score) => {
    const { container } = render(<ScoreBadge score={score} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("uses one decimal and a readable score label", () => {
    render(<ScoreBadge score={8.86} />);
    expect(screen.getByLabelText("评分 8.9 分")).toHaveTextContent("8.9");
  });
});
