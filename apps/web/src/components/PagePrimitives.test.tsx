import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Artwork } from "./PagePrimitives";

describe("Artwork", () => {
  afterEach(cleanup);

  it("renders a placeholder when the source is empty", () => {
    const { container } = render(<Artwork containerClassName="poster" src="" alt="空海报" />);

    expect(screen.queryByRole("img", { name: "空海报" })).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("poster", "is-image-missing");
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
