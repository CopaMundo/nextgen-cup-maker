import { describe, expect, it } from "vitest";
import { BOWL_BOTTOM, bowlHeight, createDrawBallWorld, drawBallFlight, drawBallRadius } from "@/lib/drawBallPhysics";

describe("draw ball physics", () => {
  it("slightly reduces the physical and rendered bowl ball radius", () => {
    expect(drawBallRadius(24)).toBeCloseTo(3.8 / Math.sqrt(30));
    expect(drawBallRadius(1)).toBe(1.25);
    expect(drawBallRadius(128)).toBeGreaterThanOrEqual(.5);
  });
  it("settles spheres above the curved bowl", () => {
    const { balls } = createDrawBallWorld(Array.from({ length: 24 }, (_, i) => String(i)));
    expect(balls.size).toBe(24);
    for (const ball of balls.values()) {
      expect(ball.position.y).toBeGreaterThan(BOWL_BOTTOM);
      expect(ball.position.y).toBeGreaterThan(bowlHeight(Math.hypot(ball.position.x, ball.position.z)) - .2);
    }
  });
  it.each([.75, 1, 1.5])("lands at 50%/47% and splits at speed %s", speed => {
    expect(drawBallFlight(0, speed).y).toBeCloseTo(BOWL_BOTTOM + .7);
    expect(drawBallFlight(1100 / speed, speed).y).toBeCloseTo(1.6875);
    expect(drawBallFlight(1450 / speed, speed).split).toBeCloseTo(.5);
    expect(drawBallFlight(1800 / speed, speed).visible).toBe(false);
    expect(drawBallFlight(550 / speed, speed).progress).toBeCloseTo(.5);
  });
  it("uses larger balls and fills both sides of the bowl", () => {
    const { balls, radius } = createDrawBallWorld(Array.from({ length: 24 }, (_, i) => String(i)));
    const positions = [...balls.values()].map(ball => ball.position.x);
     expect(radius).toBeCloseTo(drawBallRadius(24));
     expect(Math.min(...positions)).toBeLessThan(-2.5);
     expect(Math.max(...positions)).toBeGreaterThan(2.5);
  });
   it.each([1, 6, 24, 49, 64, 128])("keeps %s enlarged balls contained with real contacts", count => {
     const { balls, radius } = createDrawBallWorld(Array.from({ length: count }, (_, i) => String(i)));
     expect(balls.size).toBe(count);
     expect(radius).toBeCloseTo(drawBallRadius(count));
     for (const ball of balls.values()) {
       expect(Number.isFinite(ball.position.y)).toBe(true);
       expect(Math.hypot(ball.position.x, ball.position.z)).toBeLessThan(5.9);
       expect(ball.position.y).toBeGreaterThan(BOWL_BOTTOM);
     }
   }, 20000);
});