import { Suspense, memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrthographicCamera } from "@react-three/drei";
import { Color, Group, Mesh, MeshPhysicalMaterial } from "three";
import { BOWL_BOTTOM, DRAW_REVEAL_Y, createDrawBallWorld, drawBallFlight } from "@/lib/drawBallPhysics";

interface Props { teamIds: string[]; drawnId?: string; revealKey: string | null; elapsed: number; speed: number; revealing: boolean; theme: string; }
interface Palette { ball: string; light: string; edge: string; }

function BallScene({ teamIds, drawnId, revealKey, elapsed, speed, revealing, palette }: Props & { palette: Palette }) {
  const simulation = useMemo(() => createDrawBallWorld(teamIds), []);
  const meshes = useRef(new Map<string, Mesh>());
  const invalidate = useThree((state) => state.invalidate);
  const flight = useRef<Group>(null);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const origin = useRef({ x: 0, y: BOWL_BOTTOM + .7 });
  const material = useMemo(() => new MeshPhysicalMaterial({ color: palette.ball, roughness: .24, metalness: .22, clearcoat: .9, clearcoatRoughness: .15 }), [palette.ball]);
  const halves = useMemo(() => { const m = material.clone(); m.transparent = true; return m; }, [material]);
  useEffect(() => () => { material.dispose(); halves.dispose(); }, [material, halves]);
  useEffect(() => {
    const selected = drawnId ? simulation.balls.get(drawnId) : undefined;
    origin.current = selected ? { x: selected.position.x, y: selected.position.y } : { x: 0, y: BOWL_BOTTOM + .7 };
  }, [drawnId, revealKey, simulation]);
  const teamKey = teamIds.join("|");
  useEffect(() => {
    const retained = new Set(teamKey.split("|"));
    for (const [id, body] of simulation.balls) if (!retained.has(id)) {
      simulation.world.removeBody(body); simulation.balls.delete(id);
      // Only neighbours resting on or beside the drawn ball need to roll in.
      const reach = simulation.radius * 4.2;
      for (const remaining of simulation.balls.values()) if (remaining.position.distanceTo(body.position) < reach) remaining.wakeUp();
    }
  }, [teamKey, simulation]);
  useFrame((_, delta) => {
    // Sleeping piles need no solver work; a single substep keeps large pots smooth.
    const awake = [...simulation.balls.values()].some(body => body.sleepState !== 2);
    if (awake) simulation.world.step(1 / 60, Math.min(delta, .05), 2);
    for (const [id, body] of simulation.balls) {
      const mesh = meshes.current.get(id);
      if (mesh) { mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); }
    }
    const frame = drawBallFlight(elapsed, speed);
    if (flight.current) {
      flight.current.visible = revealing && frame.visible;
      const progress = frame.progress;
      flight.current.position.set(origin.current.x * (1 - progress), origin.current.y + (DRAW_REVEAL_Y - origin.current.y) * progress, 8);
       // Match the selected physical sphere at takeoff, retaining the same
       // reveal size and shared landing coordinates at the end of the flight.
       flight.current.scale.setScalar(simulation.radius / 1.9 + (1 - simulation.radius / 1.9) * progress);
    }
    halves.opacity = Math.pow(1 - frame.split, 2);
    for (const [mesh, direction] of [[left.current, -1], [right.current, 1]] as const) {
      if (mesh) { mesh.position.x = direction * frame.split * 5; mesh.position.y = -frame.split * .6; mesh.rotation.z = direction * frame.split * .45; }
    }
    // On-demand rendering: keep drawing only while balls roll or a ball is in flight.
    if (awake || (revealing && frame.visible)) invalidate();
  });
  useEffect(() => { invalidate(); }, [invalidate, revealing, elapsed, teamKey, drawnId, revealKey, material]);
  // Ball meshes only change when a team leaves the pot, not on every playback tick.
  const ballMeshes = useMemo(() => teamKey ? teamKey.split("|").map(id => <mesh key={id} ref={mesh => { if (mesh) meshes.current.set(id, mesh); else meshes.current.delete(id); }} material={material}>
    <sphereGeometry args={[simulation.radius, 20, 14]} />
  </mesh>) : null, [teamKey, material, simulation.radius]);
  return <>
    <ambientLight intensity={1.2} />
    <directionalLight position={[-12, 25, 30]} intensity={3} color={palette.light} />
    <Suspense fallback={null}><Environment resolution={64} frames={1}>
      <Lightformer position={[0, 20, 10]} scale={[30, 10, 1]} intensity={3} color={palette.light} />
      <Lightformer position={[-12, 0, 10]} scale={[4, 30, 1]} intensity={2} color={palette.edge} />
    </Environment></Suspense>
    {ballMeshes}
    <group ref={flight} visible={false}>
      <mesh ref={left} material={halves}><sphereGeometry args={[1.9, 32, 24, -Math.PI / 2, Math.PI]} /></mesh>
      <mesh ref={right} material={halves}><sphereGeometry args={[1.9, 32, 24, Math.PI / 2, Math.PI]} /></mesh>
    </group>
  </>;
}

/** Transparent full-stage coordinates retain the shared 50% / 47% reveal origin. */
function DrawBallsCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const css = getComputedStyle(host.current);
    const color = (token: string) => {
      const [h, s, l] = css.getPropertyValue(token).trim().split(/\s+/);
      return new Color(`hsl(${h}, ${s}, ${l})`).getStyle();
    };
    setPalette({ ball: color("--stage-ball"), light: color("--stage-ball-light"), edge: color("--stage-metal-main") });
  }, [props.theme]);
  // A change of pot/reset remounts the physical pile; removing a team does not.
  const generation = useRef({ count: props.teamIds.length, key: 0 });
  if (props.teamIds.length > generation.current.count) generation.current.key++;
  generation.current.count = props.teamIds.length;
  return <div ref={host} className="draw-show-balls-canvas" aria-hidden="true">
    {palette && <Canvas frameloop="demand" dpr={[1, 1.25]} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}>
      <OrthographicCamera makeDefault manual position={[0, 0, 100]} left={-50} right={50} top={28.125} bottom={-28.125} near={.1} far={200} />
      <BallScene key={generation.current.key} {...props} palette={palette} />
    </Canvas>}
  </div>;
}
/** Idle stage refreshes must not re-render (and re-draw) the 3D pile. */
export const DrawBalls = memo(DrawBallsCanvas, (previous, next) =>
  previous.teamIds.join("|") === next.teamIds.join("|") && previous.drawnId === next.drawnId && previous.revealKey === next.revealKey
  && previous.revealing === next.revealing && previous.speed === next.speed && previous.theme === next.theme
  && (!next.revealing || previous.elapsed === next.elapsed));
