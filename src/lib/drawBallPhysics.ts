import { Body, Material, ContactMaterial, GSSolver, SAPBroadphase, Sphere, Trimesh, Vec3, World } from "cannon-es";

// Shared orthographic cavity: rounded glass sits on the uploaded podium,
// with its inner floor at 74% and retaining rim at approximately 66.5%.
export const BOWL_BOTTOM = -13.5;
export const BOWL_RADIUS = 4.6;
/** Center of the dark band between the two middle studio LED rings (39.3% / 49.4%). */
export const DRAW_REVEAL_FRACTION = .443;
export const DRAW_REVEAL_Y = (0.5 - DRAW_REVEAL_FRACTION) * 56.25;
export const bowlHeight = (radius: number) => BOWL_BOTTOM + .1 * radius * radius + .0022 * Math.pow(radius, 4);

/** Few teams get large tactile balls; larger pots shrink gradually to fill the bowl. */
export const drawBallRadius = (count: number) => Math.max(.8, Math.min(1.25, 3.8 / Math.sqrt(count + 6)));

/** A hidden concave bowl: real sphere contacts, gravity, rolling and settling. */
export function createDrawBallWorld(ids: string[]) {
  const world = new World({ gravity: new Vec3(0, -25, 0), allowSleep: true });
  world.broadphase = new SAPBroadphase(world);
  const solver = new GSSolver();
  solver.iterations = 16;
  solver.tolerance = .001;
  world.solver = solver;
  const material = new Material("draw-ball");
  // Orthographic depth holds large pots without increasing the visible bowl silhouette.
  const depth = Math.max(1, ids.length / 40);
  world.addContactMaterial(new ContactMaterial(material, material, { friction: .35, restitution: 0, contactEquationRelaxation: 4, contactEquationStiffness: 1e6 }));
  const vertices: number[] = [];
  const indices: number[] = [];
   const rings = 8, segments = 20;
   // Continue the concave contacts with a retaining rim so large spheres
   // cannot roll over the mesh edge while the pile is settling.
   for (let ring = 0; ring <= rings + 1; ring++) {
     const radius = BOWL_RADIUS * Math.min(ring, rings) / rings;
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment * Math.PI * 2 / segments;
       vertices.push(Math.cos(angle) * radius, ring > rings ? 40 : bowlHeight(radius), Math.sin(angle) * radius * depth);
    }
  }
   for (let ring = 0; ring <= rings; ring++) for (let segment = 0; segment < segments; segment++) {
    const a = ring * segments + segment, b = ring * segments + (segment + 1) % segments;
    const c = a + segments, d = b + segments;
    indices.push(a, b, c, b, d, c);
  }
  world.addBody(new Body({ mass: 0, material, shape: new Trimesh(vertices, indices) }));
  const radius = drawBallRadius(ids.length);
  // Place every ball where it would come to rest and start asleep (a synchronous
  // settling simulation blocked the stage for seconds). Each ball drops into the
  // lowest free spot of the bowl or the pile, so the pile fills from the centre
  // upwards with a calm, level surface instead of a ring or loose lumps.
  const maxRadial = BOWL_RADIUS - radius - .12;
  const step = radius * .42;
  const candidates: { x: number; z: number }[] = [];
  const steps = Math.ceil(maxRadial / step);
  const depthSteps = Math.ceil(maxRadial * depth / step);
  for (let row = -depthSteps; row <= depthSteps; row++) for (let column = -steps; column <= steps; column++) {
    // Deterministic micro-offsets avoid a visible lattice while refreshes stay reproducible.
    const seed = Math.sin(row * 127.1 + column * 311.7) * 43758.5453;
    const jitter = (seed - Math.floor(seed) - .5) * step * .5;
    const x = column * step + jitter, z = row * step - jitter * .7;
    if (Math.hypot(x, z / depth) <= maxRadial) candidates.push({ x, z });
  }
  const surface = (x: number, z: number) => {
    const d = Math.hypot(x, z / depth);
    const slope = .2 * d + .0088 * d * d * d;
    return bowlHeight(d) + radius * Math.sqrt(1 + slope * slope);
  };
  const placed: { x: number; y: number; z: number }[] = [];
  const restingY = (x: number, z: number) => {
    let y = surface(x, z);
    for (const other of placed) {
      const d2 = (other.x - x) ** 2 + (other.z - z) ** 2;
      const reach = 4 * radius * radius - d2;
      if (reach > 0) y = Math.max(y, other.y + Math.sqrt(reach) + .004);
    }
    return y;
  };
  const heights = candidates.map((candidate) => surface(candidate.x, candidate.z));
  const balls = new Map<string, Body>();
  ids.forEach((id) => {
    let best = 0;
    for (let index = 1; index < candidates.length; index++) if (heights[index] < heights[best] - 1e-6) best = index;
    const { x, z } = candidates[best] ?? { x: 0, z: 0 };
    const y = heights[best] ?? restingY(0, 0);
    placed.push({ x, y, z });
    // Only heights near the new ball change.
    candidates.forEach((candidate, index) => {
      const d2 = (candidate.x - x) ** 2 + (candidate.z - z) ** 2;
      const reach = 4 * radius * radius - d2;
      if (reach > 0) heights[index] = Math.max(heights[index], y + Math.sqrt(reach) + .004);
    });
    const body = new Body({ mass: 1, material, shape: new Sphere(radius), linearDamping: .95, angularDamping: .98, sleepSpeedLimit: .5, sleepTimeLimit: .45 });
    body.position.set(x, y, z);
    world.addBody(body); balls.set(id, body);
    body.sleep();
  });
  // The pre-seeded pile is already supported. Solver penetration corrections
  // must not inject upward energy when that support is removed during a draw.
  const previousHeights = new Map<Body, number>();
  const previousPositions = new Map<Body, Vec3>();
  const quietTime = new Map<Body, number>();
  world.addEventListener("preStep", () => {
    previousHeights.clear();
    for (const ball of balls.values()) {
      previousHeights.set(ball, ball.position.y);
      const previous = previousPositions.get(ball) ?? new Vec3();
      previous.copy(ball.position);
      previousPositions.set(ball, previous);
      // Cannon emits preStep after contact solving, before integration. Limit
      // sideways correction energy but preserve vertical contact resolution.
      ball.velocity.y = Math.max(-1.2, ball.velocity.y);
      const lateral = Math.hypot(ball.velocity.x, ball.velocity.z);
      if (lateral > .4) {
        ball.velocity.x *= .4 / lateral;
        ball.velocity.z *= .4 / lateral;
      }
    }
  });
  world.addEventListener("postStep", () => {
    const supported = new Set<Body>();
    for (const contact of world.contacts) {
      if (contact.ni.y < -.2) supported.add(contact.bi);
      if (contact.ni.y > .2) supported.add(contact.bj);
    }
    for (const ball of balls.values()) {
      if (ball.sleepState === Body.SLEEPING) { quietTime.delete(ball); continue; }
      const ceiling = previousHeights.get(ball);
      // Permit subpixel contact correction rather than locking penetrating
      // bodies together (which made the solver eject their neighbours sideways).
      if (ceiling !== undefined && ball.position.y > ceiling + .02) {
        ball.position.y = ceiling + .02;
        ball.aabbNeedsUpdate = true;
      }
      if (ball.velocity.y > 0) ball.velocity.y = 0;
      ball.velocity.y = Math.max(-1.2, ball.velocity.y);
      const horizontalSpeed = Math.hypot(ball.velocity.x, ball.velocity.z);
      if (horizontalSpeed > .65) {
        ball.velocity.x *= .65 / horizontalSpeed;
        ball.velocity.z *= .65 / horizontalSpeed;
      }
      // Judge rest from actual displacement and real supporting contacts,
      // not the solver's residual velocity. Unsupported balls must keep falling.
      const previous = previousPositions.get(ball);
      const quiet = supported.has(ball) && previous && Math.abs(ball.position.y - previous.y) < .025;
      const duration = quiet ? (quietTime.get(ball) ?? 0) + world.dt : Math.max(0, (quietTime.get(ball) ?? 0) - world.dt);
      quietTime.set(ball, duration);
      if (duration >= .45) ball.sleep();
    }
  });
  return { world, balls, radius, depth };
}

export function drawBallFlight(elapsed: number, speed: number) {
  const time = elapsed * speed;
  const progress = Math.max(0, Math.min(1, time / 1100));
  const eased = progress * progress * (3 - 2 * progress);
  return { progress: eased, y: BOWL_BOTTOM + .7 + (DRAW_REVEAL_Y - BOWL_BOTTOM - .7) * eased, scale: .29 + .71 * eased, split: Math.max(0, Math.min(1, (time - 1100) / 700)), visible: time < 1800 };
}