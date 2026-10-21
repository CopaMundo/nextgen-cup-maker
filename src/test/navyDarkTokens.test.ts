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
    const block = darkBlock('[data-broadcast="copa_mundo_bc"][data-mode="dark"] {');
    expect(block).toContain("--background: 222 51% 14%");
    expect(block).toContain("--card: var(--background)");
    expect(block).toContain("--secondary: 222 49% 22%");
  });

  it("temporary navy preview switcher is fully removed", () => {
    expect(css).not.toContain("data-navy");
    expect(css).not.toContain("Tijdelijke nachtblauw");
  });
});
