import { Body, Material, ContactMaterial, Sphere, Trimesh, Vec3, World } from "cannon-es";

export const BOWL_BOTTOM = -14.05;
export const BOWL_RADIUS = 5.9;
export const bowlHeight = (radius: number) => BOWL_BOTTOM + .195 * radius * radius;

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
  const radius = ids.length > 49 ? .36 : .56;
  const balls = new Map<string, Body>();
  ids.forEach((id, index) => {
    const angle = index * 2.399963;
    const radial = Math.min(4.3, .7 * Math.sqrt(index));
    const body = new Body({ mass: 1, material, shape: new Sphere(radius), linearDamping: .24, angularDamping: .4, sleepSpeedLimit: .08, sleepTimeLimit: .7 });
    body.position.set(Math.cos(angle) * radial, bowlHeight(radial) + radius + .6 + Math.floor(index / 40) * 1.2, Math.sin(angle) * radial);
    body.velocity.set(Math.sin(angle) * .3, 0, Math.cos(angle) * .3);
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