import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/ui/BottomNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/today",
}));

describe("BottomNav", () => {
  it("renders all three tabs and highlights the active one", () => {
    render(<BottomNav />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("ホーム")).toHaveStyle({ color: "var(--color-primary-ink)" });
    expect(screen.getByText("スタッフ")).toHaveStyle({ color: "var(--color-ink-weakest)" });
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});
