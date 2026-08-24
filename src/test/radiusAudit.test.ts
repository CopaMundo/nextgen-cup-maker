import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Radius-audit: garandeert dat afrondingen sitebreed via het --radius token lopen.
 * Voorkomt dat nieuwe code harde pixelwaarden of afwijkende afrondingen introduceert
 * in formulieren, modals, dropdowns of tabellen.
 */

const SRC = join(process.cwd(), "src");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx|ts)$/.test(entry) ? [full] : [];
  });

const files = walk(SRC).filter((f) => !f.includes("/test/"));

describe("radius audit", () => {
  it("gebruikt geen willekeurige rounded-[..px] waarden in app-code", () => {
    const offenders: string[] = [];
    for (const file of files) {
      // shadcn primitives en de broadcast-stijltokens mogen expliciete waarden zetten
      if (file.includes("/components/ui/") || file.endsWith("broadcastStyles.ts")) continue;
      const content = readFileSync(file, "utf8");
      const matches = content.match(/rounded-\[[0-9.]+(px|rem)\]/g);
      if (matches) offenders.push(`${file}: ${matches.join(", ")}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("definieert --radius voor light én dark basis-thema", () => {
    const css = readFileSync(join(SRC, "index.css"), "utf8");
    const root = css.match(/:root,\s*\[data-mode="dark"\]\s*{[\s\S]*?}/);
    const light = css.match(/\[data-mode="light"\]\s*{[\s\S]*?}/);
    expect(root?.[0]).toMatch(/--radius:/);
    expect(light?.[0]).toMatch(/--radius:/);
    const values = [...css.matchAll(/--radius:\s*([^;]+);/g)].map((m) => m[1].trim());
    // basis (dark) en light moeten identiek zijn
    expect(values[0]).toBe(values[1]);
  });

  it("normaliseert grote Tailwind radii naar var(--radius)", () => {
    const css = readFileSync(join(SRC, "index.css"), "utf8");
    for (const cls of [".rounded-lg", ".rounded-xl", ".rounded-2xl", ".rounded-3xl"]) {
      expect(css).toContain(cls);
    }
    expect(css).toMatch(/@layer utilities\s*{[\s\S]*rounded-2xl[\s\S]*border-radius: var\(--radius\)/);
  });
});
