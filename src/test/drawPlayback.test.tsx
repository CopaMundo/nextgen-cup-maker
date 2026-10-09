import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDrawPlayback } from "@/hooks/useDrawPlayback";
import type { DrawPicture } from "@/lib/drawPresentation";
import { initContainersState } from "@/lib/drawSession";
import { emptyContainerRules } from "@/lib/liveDraw";

let time = 0;
let callback: FrameRequestCallback | undefined;
function advance(milliseconds: number, step = 16) {
  act(() => {
    for (let remaining = milliseconds; remaining > 0; remaining -= step) {
      time += Math.min(step, remaining);
      callback?.(time);
    }
  });
}
function picture(teamId = "a", revealAt = 1000, speed = 1): DrawPicture {
  const session = initContainersState({ phaseName: "Loting", mode: "random", teams: [{ id: "a", name: "Team A" }, { id: "b", name: "Team B" }], pots: [], containers: [], rules: emptyContainerRules() });
  session.pending = { teamId, options: [] };
  return { session, spotlightId: null, presentation: { revealAt, speed, activePotId: null, selection: null } };
}
beforeEach(() => {
  time = 0;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => { callback = next; return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); callback = undefined; });

describe("Uninterrupted team reveal playback", () => {
  it.each([.5, 1, 3])("starts delayed pictures at the bowl and completes at speed %s", (speed) => {
    const { result } = renderHook(() => useDrawPlayback(picture("a", Date.now() - 10000, speed)));
    expect(result.current.revealElapsed).toBe(0);
    expect(result.current.revealing).toBe(true);
    advance(1100 / speed);
    expect(result.current.revealing).toBe(true);
    advance(800 / speed + 20);
    expect(result.current.revealing).toBe(false);
  });
  it("caps renderer stalls instead of skipping flight and split", () => {
    const { result } = renderHook(() => useDrawPlayback(picture()));
    advance(10000, 10000);
    expect(result.current.revealElapsed).toBe(64);
    expect(result.current.revealing).toBe(true);
  });
  it("finishes a reveal before accepting placement or a cleared pending team", () => {
    const first = picture();
    const { result, rerender } = renderHook(({ input }) => useDrawPlayback(input), { initialProps: { input: first } });
    advance(300);
    rerender({ input: { ...first, session: { ...first.session, pending: null } } });
    expect(result.current.session?.pending?.teamId).toBe("a");
    advance(1650);
    expect(result.current.session?.pending).toBeNull();
  });
  it("queues subsequent team draws and distinguishes redraws of the same club", () => {
    const { result, rerender } = renderHook(({ input }) => useDrawPlayback(input), { initialProps: { input: picture() } });
    rerender({ input: picture("b", 2000) });
    expect(result.current.session?.pending?.teamId).toBe("a");
    advance(1920);
    expect(result.current.session?.pending?.teamId).toBe("b");
    expect(result.current.revealing).toBe(true);
    advance(1920);
    rerender({ input: picture("b", 3000) });
    expect(result.current.revealElapsed).toBe(0);
    expect(result.current.revealing).toBe(true);
  });
  it("does not restart for opponent updates or change speed halfway through", () => {
    const first = picture();
    const { result, rerender } = renderHook(({ input }) => useDrawPlayback(input), { initialProps: { input: first } });
    advance(500);
    const update = { ...first, presentation: { ...first.presentation, speed: 3 } } as DrawPicture;
    rerender({ input: update });
    expect(result.current.presentation?.speed).toBe(1);
    expect(result.current.revealElapsed).toBe(500);
    advance(1450);
    rerender({ input: { ...update, spotlightId: "opponent" } });
    expect(result.current.revealing).toBe(false);
  });
});