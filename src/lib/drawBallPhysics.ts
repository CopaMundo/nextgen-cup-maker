import { Body, Material, ContactMaterial, Sphere, Trimesh, Vec3, World } from "cannon-es";

export const BOWL_BOTTOM = -14.05;
export const BOWL_RADIUS = 5.9;
export const bowlHeight = (radius: number) => BOWL_BOTTOM + .025 * radius * radius + .004 * Math.pow(radius, 4);

/** A hidden concave bowl: real sphere contacts, gravity, rolling and settling. */
export function createDrawBallWorld(ids: string[]) {
  const world = new World({ gravity: new Vec3(0, -25, 0), allowSleep: true });
  const material = new Material("draw-ball");
  world.addContactMaterial(new ContactMaterial(material, material, { friction: .32, restitution: .13 }));
  const vertices: number[] = [];
  const indices: number[] = [];
  const rings = 12, segments = 32;
  for (let ring = 0; ring <= rings; ring++) {
    const radius = BOWL_RADIUS * ring / rings;
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment * Math.PI * 2 / segments;
      vertices.push(Math.cos(angle) * radius, bowlHeight(radius), Math.sin(angle) * radius);
    }
  }
  for (let ring = 0; ring < rings; ring++) for (let segment = 0; segment < segments; segment++) {
    const a = ring * segments + segment, b = ring * segments + (segment + 1) % segments;
    const c = a + segments, d = b + segments;
    indices.push(a, b, c, b, d, c);
  }
  world.addBody(new Body({ mass: 0, material, shape: new Trimesh(vertices, indices) }));
  const radius = ids.length > 49 ? .99 : 1.53;
  // Hexagonal layers avoid an overlapping spiral pile at the bowl's center.
  // Keep sphere edges within the rim while filling its full left/right span.
  const spacing = radius * 2 + .08;
  const rowSpacing = spacing * Math.sqrt(3) / 2;
  const maxRadial = BOWL_RADIUS - radius - .12;
  const layer: { x: number; z: number }[] = [];
  const rows = Math.ceil(maxRadial / rowSpacing);
  const columns = Math.ceil(maxRadial / spacing);
  for (let row = -rows; row <= rows; row++) {
    for (let column = -columns; column <= columns; column++) {
      const x = column * spacing + (Math.abs(row) % 2 ? spacing / 2 : 0);
      const z = row * rowSpacing;
      if (Math.hypot(x, z) <= maxRadial) layer.push({ x, z });
    }
  }
  layer.sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z) || a.x - b.x);
  const layerBase = bowlHeight(maxRadial) + radius + .1;
  const balls = new Map<string, Body>();
  ids.forEach((id, index) => {
    const position = layer[index % layer.length];
    if (!position) return;
    const body = new Body({ mass: 1, material, shape: new Sphere(radius), linearDamping: .24, angularDamping: .4, sleepSpeedLimit: .08, sleepTimeLimit: .7 });
    body.position.set(position.x, layerBase + Math.floor(index / layer.length) * spacing, position.z);
    body.velocity.set(-position.z * .025, 0, position.x * .025);
    world.addBody(body); balls.set(id, body);
  });
  // Start with a settled, deterministic arrangement instead of a falling pile.
  for (let i = 0; i < 180; i++) world.step(1 / 60);
  return { world, balls, radius };
}

export function drawBallFlight(elapsed: number, speed: number) {
  const time = elapsed * speed;
  const progress = Math.max(0, Math.min(1, time / 1100));
  const eased = 1 - Math.pow(1 - progress, 3);
  return { y: -10.85625 + (3.375 + 10.85625) * eased, scale: .29 + .71 * eased, split: Math.max(0, Math.min(1, (time - 1100) / 550)), visible: time < 1650 };
}