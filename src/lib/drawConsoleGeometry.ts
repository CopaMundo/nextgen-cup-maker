import { BufferGeometry, Float32BufferAttribute } from "three";

/** Restrained bow and slight tapered ends follow the studio's inner pillars. */
export function consoleContour(x: number) {
  return { z: .4 - .012 * x * x, inset: 0, rise: .4 * (x / 6.5) ** 2 };
}

export function consoleBand(top: number, bottom: number, depth = .12) {
  const geometry = new BufferGeometry();
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  const segments = 160;
  for (let i = 0; i <= segments; i++) {
    const x = -6.5 + 13 * i / segments;
    const { z, rise } = consoleContour(x);
    const upperX = x * (1 - .025 * (top + 1));
    const lowerX = x * (1 - .025 * (bottom + 1));
    vertices.push(upperX, top + rise, z, lowerX, bottom + rise, z, upperX, top + rise, z - depth, lowerX, bottom + rise, z - depth);
    uv.push(i / segments, 1, i / segments, 0, i / segments, 1, i / segments, 0);
    if (i < segments) {
      const a = i * 4, b = a + 4;
      indices.push(a, a + 1, b, b, a + 1, b + 1, a + 2, a, b + 2, b + 2, a, b, a + 1, a + 3, b + 1, b + 1, a + 3, b + 3, a + 3, a + 2, b + 3, b + 3, a + 2, b + 2);
    }
  }
  indices.push(0, 2, 1, 1, 2, 3);
  const end = segments * 4;
  indices.push(end, end + 1, end + 2, end + 2, end + 1, end + 3);
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}