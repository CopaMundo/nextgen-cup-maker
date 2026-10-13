import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminSectionLayout, { AdminSection } from "@/components/admin/AdminSectionLayout";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Desktop admin section navigation", () => {
  it("keeps sections mounted and jumps through the admin scroll pane", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const scrollRoot = createRef<HTMLDivElement>();
    const scrollTo = vi.fn();
    const sections = [{ id: "info", label: "Toernooi-informatie" }, { id: "days", label: "Wedstrijddagen" }];
    render(<div ref={scrollRoot}><AdminSectionLayout scrollRoot={scrollRoot} sections={sections}>
      <AdminSection id="info" title="Toernooi-informatie"><input aria-label="Naam" defaultValue="Copa Mundo" /></AdminSection>
      <AdminSection id="days" title="Wedstrijddagen">Datums</AdminSection>
    </AdminSectionLayout></div>);
    const root = scrollRoot.current;
    if (!root) throw new Error("Missing scroll pane");
    root.scrollTo = scrollTo;
    fireEvent.click(screen.getByRole("button", { name: "Wedstrijddagen" }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect(screen.getByRole("button", { name: "Wedstrijddagen" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("heading", { name: "Wedstrijddagen" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Naam" })).toHaveValue("Copa Mundo");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });
});