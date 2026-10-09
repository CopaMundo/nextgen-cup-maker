import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrthographicCamera } from "@react-three/drei";
import { Color, Group, Mesh, MeshPhysicalMaterial } from "three";
import { createDrawBallWorld, drawBallFlight } from "@/lib/drawBallPhysics";

interface Props { teamIds: string[]; drawnId?: string; revealKey: string | null; elapsed: number; speed: number; revealing: boolean; theme: string; }
interface Palette { ball: string; light: string; edge: string; }

function BallScene({ teamIds, drawnId, revealKey, elapsed, speed, revealing, palette }: Props & { palette: Palette }) {
  const simulation = useMemo(() => createDrawBallWorld(teamIds), []);
  const meshes = useRef(new Map<string, Mesh>());
  const flight = useRef<Group>(null);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const origin = useRef({ x: 0, y: -10.85625 });
  const material = useMemo(() => new MeshPhysicalMaterial({ color: palette.ball, roughness: .24, metalness: .22, clearcoat: .9, clearcoatRoughness: .15 }), [palette.ball]);
  const halves = useMemo(() => { const m = material.clone(); m.transparent = true; return m; }, [material]);
  useEffect(() => () => { material.dispose(); halves.dispose(); }, [material, halves]);
  useEffect(() => {
    const selected = drawnId ? simulation.balls.get(drawnId) : undefined;
    origin.current = selected ? { x: selected.position.x, y: selected.position.y } : { x: 0, y: -10.85625 };
  }, [drawnId, revealKey, simulation]);
  useEffect(() => {
    const retained = new Set(teamIds);
    for (const [id, body] of simulation.balls) if (!retained.has(id)) {
      simulation.world.removeBody(body); simulation.balls.delete(id);
      for (const remaining of simulation.balls.values()) remaining.wakeUp();
    }
  }, [teamIds, simulation]);
  useFrame((_, delta) => {
    simulation.world.step(1 / 60, Math.min(delta, .05), 3);
    for (const [id, body] of simulation.balls) {
      const mesh = meshes.current.get(id);
      if (mesh) { mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); }
    }
    const frame = drawBallFlight(elapsed, speed);
    if (flight.current) {
      flight.current.visible = revealing && frame.visible;
      const progress = 1 - Math.pow(1 - Math.min(1, elapsed * speed / 1100), 3);
      flight.current.position.set(origin.current.x * (1 - progress), origin.current.y + (3.375 - origin.current.y) * progress, 8);
       // Match the selected physical sphere at takeoff, retaining the same
       // reveal size and shared landing coordinates at the end of the flight.
       flight.current.scale.setScalar(simulation.radius / 1.9 + (1 - simulation.radius / 1.9) * progress);
    }
    halves.opacity = 1 - Math.min(1, frame.split * 1.15);
    for (const [mesh, direction] of [[left.current, -1], [right.current, 1]] as const) {
      if (mesh) { mesh.position.x = direction * frame.split * 5; mesh.rotation.z = direction * frame.split * .45; }
    }
  });
  return <>
    <ambientLight intensity={1.2} />
    <directionalLight position={[-12, 25, 30]} intensity={3} color={palette.light} />
    <Suspense fallback={null}><Environment resolution={64} frames={1}>
      <Lightformer position={[0, 20, 10]} scale={[30, 10, 1]} intensity={3} color={palette.light} />
      <Lightformer position={[-12, 0, 10]} scale={[4, 30, 1]} intensity={2} color={palette.edge} />
    </Environment></Suspense>
    {teamIds.map(id => <mesh key={id} ref={mesh => { if (mesh) meshes.current.set(id, mesh); else meshes.current.delete(id); }} material={material}>
      <sphereGeometry args={[simulation.radius, 20, 14]} />
    </mesh>)}
    <group ref={flight} visible={false}>
      <mesh ref={left} material={halves}><sphereGeometry args={[1.9, 32, 24, -Math.PI / 2, Math.PI]} /></mesh>
      <mesh ref={right} material={halves}><sphereGeometry args={[1.9, 32, 24, Math.PI / 2, Math.PI]} /></mesh>
    </group>
  </>;
}

/** Transparent full-stage coordinates retain the shared 50% / 44% reveal origin. */
export function DrawBalls(props: Props) {
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
    {palette && <Canvas dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
      <OrthographicCamera makeDefault manual position={[0, 0, 100]} left={-50} right={50} top={28.125} bottom={-28.125} near={.1} far={200} />
      <BallScene key={generation.current.key} {...props} palette={palette} />
    </Canvas>}
  </div>;
}