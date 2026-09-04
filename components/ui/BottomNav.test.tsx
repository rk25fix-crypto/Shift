import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/ui/BottomNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/today",
}));

describe("BottomNav", () => {
  it("renders all five tabs and highlights the active one", () => {
    render(<BottomNav />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("今日")).toHaveClass("text-indigo-600");
    expect(screen.getByText("スタッフ")).toHaveClass("text-gray-500");
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });
});
