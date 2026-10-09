import { useLayoutEffect, useRef, useState } from "react";
import { revealDuration, type DrawPicture } from "@/lib/drawPresentation";

type StagePicture = Partial<DrawPicture>;
const eventKey = (picture: StagePicture) => picture.session?.pending && picture.presentation?.revealAt
  ? `${picture.session.pending.teamId}:${picture.presentation.revealAt}` : null;

/** Each receiver completes a team reveal before consuming newer pictures. */
export function useDrawPlayback(incoming: StagePicture) {
  const latest = useRef(incoming);
  const active = useRef<{ key: string; picture: StagePicture; elapsed: number; speed: number } | null>(null);
  const queue = useRef<StagePicture[]>([]);
  const completed = useRef(new Set<string>());
  const [, redraw] = useState(0);

  useLayoutEffect(() => {
    latest.current = incoming;
    const key = eventKey(incoming);
    if (active.current?.key === key) {
      active.current.picture = incoming;
    } else if (key && !completed.current.has(key)) {
      const index = queue.current.findIndex((picture) => eventKey(picture) === key);
      if (index >= 0) queue.current[index] = incoming;
      else queue.current.push(incoming);
    }
    if (!active.current && queue.current.length) {
      const picture = queue.current.shift();
      const nextKey = picture && eventKey(picture);
      if (picture && nextKey) active.current = { key: nextKey, picture, elapsed: 0, speed: picture.presentation?.speed ?? 1 };
    }
    redraw((value) => value + 1);
  }, [incoming.session, incoming.presentation, incoming.spotlightId]);

  useLayoutEffect(() => {
    let previous = performance.now();
    let frame = 0;
    const tick = (timestamp: number) => {
      const current = active.current;
      // A suspended tab or a busy renderer must not skip the entire flight.
      if (current && !document.hidden) current.elapsed += Math.min(64, Math.max(0, timestamp - previous));
      previous = timestamp;
      if (current && current.elapsed >= revealDuration(current.speed)) {
        completed.current.add(current.key);
        // Bound bookkeeping during long shows.
        if (completed.current.size > 256) completed.current.delete(completed.current.values().next().value ?? "");
        active.current = null;
        const picture = queue.current.shift();
        const key = picture && eventKey(picture);
        if (picture && key) active.current = { key, picture, elapsed: 0, speed: picture.presentation?.speed ?? 1 };
      }
      redraw((value) => value + 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const current = active.current;
  const picture = current?.picture ?? latest.current;
  return {
    ...picture,
    presentation: current && picture.presentation ? { ...picture.presentation, speed: current.speed, selection: null, sweep: null } : picture.presentation,
    revealKey: current?.key ?? eventKey(picture),
    revealElapsed: current?.elapsed ?? (picture.presentation ? revealDuration(picture.presentation.speed) : 0),
    revealing: Boolean(current),
    now: current ? (picture.presentation?.revealAt ?? 0) + current.elapsed : Date.now(),
  };
}