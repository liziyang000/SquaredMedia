import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TestRoutingProvider } from "../app/routing";
import { SiteHeader } from "./SiteHeader";

function renderHeader() {
  return render(
    <TestRoutingProvider href="/">
      <SiteHeader siteName="平方影视" categories={[{ id: "42", name: "电影" }]} />
    </TestRoutingProvider>
  );
}

describe("SiteHeader themes", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.theme;
  });

  it("offers, applies, and restores the Dunhuang caisson theme", async () => {
    const firstRender = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "敦煌流光" }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dunhuang-caisson"));
    expect(localStorage.getItem("pingfang_theme")).toBe("dunhuang-caisson");

    firstRender.unmount();
    renderHeader();

    await waitFor(() => expect(screen.getAllByRole("button", { name: "敦煌流光", hidden: true })[0]).toHaveAttribute("aria-pressed", "true"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dunhuang-caisson");
  });
});
