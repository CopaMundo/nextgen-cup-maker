import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import outlines from "@/assets/fonts/barlow-condensed-semibold.typeface.json";

const font = new FontLoader().parse(outlines);

/** Real extruded outlines, optically centered and bounded to the rear-wall area. */
export function wallLetterGeometry(text: string, height: number, width: number, tracking = 0) {
  const normalized = text.trim().toUpperCase() || "COPA MUNDO";
  const geometry = new TextGeometry(normalized, {
    font, size: 1, depth: .065, curveSegments: 8,
    bevelEnabled: true, bevelThickness: .018, bevelSize: .012, bevelSegments: 3,
  });
  // Spread small captions by shifting each outline using its original pen advance.
  if (tracking > 0) {
    geometry.dispose();
    const shapes = [];
    let advance = 0;
    for (const character of normalized) {
      const glyph = font.data.glyphs[character] ?? font.data.glyphs["?"];
      const letter = font.generateShapes(character, 1);
      for (const shape of letter) {
        for (const curve of [...shape.curves, ...shape.holes.flatMap(hole => hole.curves)]) {
          const points = curve as unknown as Record<string, { x: number } | undefined>;
          for (const key of ["v1", "v2", "v0", "v3"]) if (points[key]) points[key].x += advance;
        }
      }
      shapes.push(...letter);
      advance += (glyph?.ha ?? 500) / font.data.resolution + tracking;
    }
    return fitGeometry(new TextGeometry("", { font, size: 1 }), height, width, shapes);
  }
  return fitGeometry(geometry, height, width);
}

import { ExtrudeGeometry, type Shape } from "three";
function fitGeometry(base: TextGeometry, height: number, width: number, shapes?: Shape[]) {
  const geometry = shapes ? new ExtrudeGeometry(shapes, { depth: .065, curveSegments: 8, bevelEnabled: true, bevelThickness: .018, bevelSize: .012, bevelSegments: 3 }) : base;
  if (shapes) base.dispose();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;
  const factor = Math.min(height / Math.max(.01, box.max.y - box.min.y), width / Math.max(.01, box.max.x - box.min.x));
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  geometry.scale(factor, factor, 1);
  geometry.computeBoundingBox();
  return geometry;
}