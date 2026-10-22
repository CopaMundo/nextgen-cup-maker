import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/index.css", "utf8");

/** Deep Navy dark-mode ladder (user-chosen fixed default). */
const darkBlock = (selector: string) => {
  const start = css.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
};

describe("Deep Navy dark tokens (Copa Mundo)", () => {
  it("admin dark background is Deep Navy canvas #111C35", () => {
    const block = darkBlock('[data-mode="dark"] .admin-ui,');
    expect(block).toContain("--background: 222 51% 14%");
    expect(block).toContain("--card: 222 50% 19%");
    expect(block).toContain("--border: 222 47% 26%");
  });

  it("base .admin-ui fallback and portaled dialogs follow the same ladder", () => {
    expect(darkBlock(".admin-ui {")).toContain("--background: 222 51% 14%");
    expect(darkBlock('[data-mode="dark"] .admin-ui.admin-dialog:not(.draw-dialog-theme)')).toContain(
      "--background: 222 51% 14%"
    );
  });

  it("copa_mundo_bc broadcast dark uses Deep Navy with card equal to background", () => {
    const selector = '[data-broadcast="copa_mundo_bc"][data-mode="dark"] {';
    let block = "";
    let idx = css.indexOf(selector);
    while (idx > -1 && !block) {
      const candidate = css.slice(idx, css.indexOf("}", idx));
      if (candidate.includes("--background")) block = candidate;
      idx = css.indexOf(selector, idx + 1);
    }
    expect(block).toContain("--background: 222 51% 14%");
    expect(block).toContain("--card: var(--background)");
    expect(block).toContain("--secondary: 222 49% 22%");
  });

  it("temporary navy preview switcher is fully removed", () => {
    expect(css).not.toContain("data-navy");
    expect(css).not.toContain("Tijdelijke nachtblauw");
  });

  it("site-wide pages (login, search, dashboard, profile) share the same dark ladder", () => {
    const block = darkBlock("[data-mode=\"dark\"] {");
    expect(block).toContain("--background: 222 51% 14%");
    expect(block).toContain("--card: 222 50% 19%");
    expect(block).toContain("--border: 222 47% 26%");
    expect(block).toContain("--primary: 52 100% 50%");
  });

  it("site-wide light mode (Richting B): white cards on a soft ice-blue background with very light borders", () => {
    const block = darkBlock("[data-mode=\"light\"] {");
    expect(block).toContain("--background: 210 40% 98%");
    expect(block).toContain("--card: 0 0% 100%");
    expect(block).toContain("--border: 214 60% 90%");
    expect(block).toContain("--input: 213 45% 82%");
    expect(block).toContain("--secondary: 214 100% 97%");
    expect(block).toContain("--accent: 214 95% 93%");
    expect(block).toContain("--muted-foreground: 215 30% 45%");
    expect(block).toContain("--primary: 220.17 100% 23.14%");
  });

  it("light mode has no mouse-gray secondary surfaces or borders left", () => {
    expect(css).not.toContain("--secondary: 220 24% 95%");
    expect(css).not.toContain("--accent: 220 20% 94%");
    expect(css).not.toContain("--border: 220 15% 82%");
    expect(css).not.toContain("--input: 220 13% 76%");
    expect(css).not.toContain("--muted-foreground: 220 8% 42%");
    expect(css).not.toContain("--background: 220 30% 97%");
  });

  it("light mode has no legacy dead-gray tokens left", () => {
    expect(css).not.toContain("--border: 0 0% 82%");
    expect(css).not.toContain("--input: 0 0% 74%");
    expect(css).not.toContain("--background: 0 0% 12%");
  });

  it("selected sidebar subtab shows only the accent bar and theme-coloured name", () => {
    const block = darkBlock('.admin-module-subnav .admin-module-sublink[aria-current="page"] {');
    expect(block).toContain("color: hsl(var(--primary))");
    expect(block).toContain("background: transparent");
    expect(block).not.toContain("hsl(var(--accent)");
    expect(css).toContain('.admin-module-sublink[aria-current="page"]::before');
    // the sidebar-wide active-button fill must not leak onto subtabs
    const scoped = darkBlock('.tournament-admin.admin-ui .admin-module-sidebar .admin-module-sublink[aria-current="page"] {');
    expect(scoped).toContain("background: transparent");
    expect(scoped).not.toContain("hsl(var(--secondary))");
  });
});
