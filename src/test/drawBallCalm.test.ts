import { describe, expect, it } from "vitest";
import { createDrawBallWorld } from "@/lib/drawBallPhysics";

describe("calm draw pile", () => {
  it("starts asleep with damped non-bouncy contacts and reproducible irregular positions", () => {
    const ids = Array.from({ length: 64 }, (_, i) => String(i));
    const a = createDrawBallWorld(ids), b = createDrawBallWorld(ids);
    expect(a.world.contactmaterials[0].restitution).toBe(0);
    for (const [id, ball] of a.balls) {
      expect(ball.sleepState).toBe(2);
      expect(ball.linearDamping).toBeGreaterThan(.6);
      expect(ball.angularDamping).toBeGreaterThan(.7);
      expect(ball.position.almostEquals(b.balls.get(id)?.position ?? ball.position)).toBe(true);
    }
    expect(new Set([...a.balls.values()].map(ball => ball.position.z.toFixed(4))).size).toBeGreaterThan(32);
  });
  it.each([32, 64, 128])("settles a local gap at %s teams without jumping above the original pile", count => {
    const { world, balls, radius } = createDrawBallWorld(Array.from({ length: count }, (_, i) => String(i)));
    const removed = balls.get("0");
    if (!removed) throw new Error("Missing drawn ball");
    world.removeBody(removed); balls.delete("0");
    const highest = Math.max(...[...balls.values()].map(ball => ball.position.y));
    const previous = new Map([...balls].map(([id, ball]) => [id, ball.position.y]));
    let upwardStep = 0;
    for (const ball of balls.values()) if (ball.position.distanceTo(removed.position) < radius * 4.2) ball.wakeUp();
    let maximum = highest;
    for (let i = 0; i < 180; i++) {
      world.step(1 / 60);
      for (const [id, ball] of balls) {
        maximum = Math.max(maximum, ball.position.y);
        upwardStep = Math.max(upwardStep, ball.position.y - (previous.get(id) ?? ball.position.y));
        previous.set(id, ball.position.y);
      }
    }
    expect(maximum - highest).toBeLessThan(.12);
    expect(upwardStep).toBeLessThan(.04);
  }, 20000);
});