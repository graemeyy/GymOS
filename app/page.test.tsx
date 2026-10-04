// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/plans/queries", () => ({ listPlans: async () => [], benefitsOf: () => [] }));
vi.mock("@/components/public/site-chrome", () => ({ SiteHeader: () => null, SiteFooter: () => null }));
const { default: HomePage } = await import("./page");

afterEach(cleanup);

describe("R-91 after deleting an account", () => {
  it("the home page confirms it", async () => {
    render(await HomePage({ searchParams: Promise.resolve({ deleted: "1" }) }));
    expect(screen.getByRole("status").textContent).toContain("Your account has been deleted");
  });

  it("says nothing on a normal visit", async () => {
    render(await HomePage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
