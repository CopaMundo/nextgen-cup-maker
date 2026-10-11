import { Body, Material, ContactMaterial, SAPBroadphase, Sphere, Trimesh, Vec3, World } from "cannon-es";

// Shared orthographic cavity: rounded glass sits on the uploaded podium,
// with its inner floor at 74% and retaining rim at approximately 66.5%.
export const BOWL_BOTTOM = -13.5;
export const BOWL_RADIUS = 4.6;
/** Center of the dark band between the two middle studio LED rings (39.3% / 49.4%). */
export const DRAW_REVEAL_FRACTION = .443;
export const DRAW_REVEAL_Y = (0.5 - DRAW_REVEAL_FRACTION) * 56.25;
export const bowlHeight = (radius: number) => BOWL_BOTTOM + .1 * radius * radius + .0022 * Math.pow(radius, 4);

/** Few teams get large tactile balls; larger pots shrink gradually to fill the bowl. */
export const drawBallRadius = (count: number) => Math.max(.5, Math.min(1.25, 3.8 / Math.sqrt(count + 6)));

/** A hidden concave bowl: real sphere contacts, gravity, rolling and settling. */
export function createDrawBallWorld(ids: string[]) {
  const world = new World({ gravity: new Vec3(0, -25, 0), allowSleep: true });
  world.broadphase = new SAPBroadphase(world);
  const material = new Material("draw-ball");
  world.addContactMaterial(new ContactMaterial(material, material, { friction: .22, restitution: 0, contactEquationRelaxation: 6 }));
  const vertices: number[] = [];
  const indices: number[] = [];
   const rings = 8, segments = 20;
   // Continue the concave contacts with a retaining rim so large spheres
   // cannot roll over the mesh edge while the pile is settling.
   for (let ring = 0; ring <= rings + 1; ring++) {
     const radius = BOWL_RADIUS * Math.min(ring, rings) / rings;
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment * Math.PI * 2 / segments;
       vertices.push(Math.cos(angle) * radius, ring > rings ? 40 : bowlHeight(radius), Math.sin(angle) * radius);
    }
  }
   for (let ring = 0; ring <= rings; ring++) for (let segment = 0; segment < segments; segment++) {
    const a = ring * segments + segment, b = ring * segments + (segment + 1) % segments;
    const c = a + segments, d = b + segments;
    indices.push(a, b, c, b, d, c);
  }
  world.addBody(new Body({ mass: 0, material, shape: new Trimesh(vertices, indices) }));
  const radius = drawBallRadius(ids.length);
  // Place every ball where it would come to rest (lowest free spot on the bowl
  // or on the balls beneath it) and start asleep. A synchronous settling
  // simulation blocked the live stage for seconds with larger pots.
  const spacing = radius * 2 + .02;
  const rowSpacing = spacing * Math.sqrt(3) / 2;
  const maxRadial = BOWL_RADIUS - radius - .12;
  const candidates: { x: number; z: number; level: number }[] = [];
  const rows = Math.ceil(maxRadial / rowSpacing) + 1;
  const columns = Math.ceil(maxRadial / spacing) + 1;
  for (let level = 0; level < 3; level++) {
    const offsetX = level * spacing / 2, offsetZ = level * rowSpacing / 3;
    for (let row = -rows; row <= rows; row++) for (let column = -columns; column <= columns; column++) {
      // Deterministic micro-offsets keep refresh recovery stable without a visible lattice.
      const seed = Math.sin(row * 127.1 + column * 311.7 + level * 74.7) * 43758.5453;
      const jitter = (seed - Math.floor(seed) - .5) * radius * .35;
      const x = column * spacing + (Math.abs(row) % 2 ? spacing / 2 : 0) + offsetX + jitter;
      const z = row * rowSpacing + offsetZ + jitter * .61;
      if (Math.hypot(x, z) <= maxRadial) candidates.push({ x, z, level });
    }
  }
  // The first layer spreads across the full bowl width (outer ring first);
  // further balls drop onto the lowest free resting spot.
  const floor = candidates.filter((candidate) => candidate.level === 0)
    .sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z) || a.x - b.x);
  const surface = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    const slope = .2 * d + .0088 * d * d * d;
    return bowlHeight(d) + radius * Math.sqrt(1 + slope * slope);
  };
  const placed: { x: number; y: number; z: number }[] = [];
  const restingY = (x: number, z: number) => {
    let y = surface(x, z);
    for (const other of placed) {
      const d2 = (other.x - x) ** 2 + (other.z - z) ** 2;
      const reach = 4 * radius * radius - d2;
      if (reach > 0) y = Math.max(y, other.y + Math.sqrt(reach) + .005);
    }
    return y;
  };
  const balls = new Map<string, Body>();
  ids.forEach((id, order) => {
    const spread = order < floor.length ? floor[order] : null;
    if (spread) {
      candidates.splice(candidates.indexOf(spread), 1);
      const y = restingY(spread.x, spread.z);
      placed.push({ x: spread.x, y, z: spread.z });
      const body = new Body({ mass: 1, material, shape: new Sphere(radius), linearDamping: .65, angularDamping: .8, sleepSpeedLimit: .12, sleepTimeLimit: .45 });
      body.position.set(spread.x, y, spread.z);
      world.addBody(body); balls.set(id, body); body.sleep();
      return;
    }
    let best = -1, bestY = Infinity;
    candidates.forEach((candidate, index) => {
      const y = restingY(candidate.x, candidate.z);
      if (y < bestY - 1e-6) { best = index; bestY = y; }
    });
    const position = best >= 0 ? candidates.splice(best, 1)[0] : { x: 0, z: 0 };
    const y = best >= 0 ? bestY : restingY(0, 0);
    placed.push({ x: position.x, y, z: position.z });
    const body = new Body({ mass: 1, material, shape: new Sphere(radius), linearDamping: .65, angularDamping: .8, sleepSpeedLimit: .12, sleepTimeLimit: .45 });
    body.position.set(position.x, y, position.z);
    world.addBody(body); balls.set(id, body);
    body.sleep();
  });
  return { world, balls, radius };
}

export function drawBallFlight(elapsed: number, speed: number) {
  const time = elapsed * speed;
  const progress = Math.max(0, Math.min(1, time / 1100));
  const eased = progress * progress * (3 - 2 * progress);
  return { progress: eased, y: BOWL_BOTTOM + .7 + (DRAW_REVEAL_Y - BOWL_BOTTOM - .7) * eased, scale: .29 + .71 * eased, split: Math.max(0, Math.min(1, (time - 1100) / 700)), visible: time < 1800 };
}