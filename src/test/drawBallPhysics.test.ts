import { describe, expect, it } from "vitest";
import { BOWL_BOTTOM, bowlHeight, createDrawBallWorld, drawBallFlight } from "@/lib/drawBallPhysics";

describe("draw ball physics", () => {
  it("settles spheres above the curved bowl", () => {
    const { balls } = createDrawBallWorld(Array.from({ length: 24 }, (_, i) => String(i)));
    expect(balls.size).toBe(24);
    for (const ball of balls.values()) {
      expect(ball.position.y).toBeGreaterThan(BOWL_BOTTOM);
      expect(ball.position.y).toBeGreaterThan(bowlHeight(Math.hypot(ball.position.x, ball.position.z)) - .2);
    }
  });
  it.each([.75, 1, 1.5])("lands at 50%/44% and splits at speed %s", speed => {
    expect(drawBallFlight(1100 / speed, speed).y).toBeCloseTo(3.375);
    expect(drawBallFlight(1375 / speed, speed).split).toBeCloseTo(.5);
    expect(drawBallFlight(1650 / speed, speed).visible).toBe(false);
  });
});