import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrthographicCamera } from "@react-three/drei";
import { CanvasTexture, Color, DoubleSide, Mesh, SRGBColorSpace } from "three";

interface HaloPalette { surface: string; dot: string; text: string; metal: string; light: string; shade: string; }
interface Props { title: string; heading: string; theme: string; }

/** Lettering follows the physical cylinder; its texture closes seamlessly around the back. */
function createDisplay(title: string, heading: string, palette: HaloPalette) {
  const canvas = document.createElement("canvas");
  canvas.width = 4096; canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = '600 170px "Barlow Condensed", "Arial Narrow", sans-serif';
  const titleWidth = ctx.measureText(title.toUpperCase()).width;
  const scrolling = titleWidth > 1400;
  canvas.width = Math.max(4096, Math.min(16384, Math.ceil(titleWidth + 640)));
  ctx.fillStyle = palette.surface; ctx.fillRect(0, 0, canvas.width, 512);
  ctx.fillStyle = palette.dot;
  for (let y = 6; y < 512; y += 12) for (let x = 6; x < canvas.width; x += 12) {
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  const repeats = scrolling ? Math.max(1, Math.floor(canvas.width / (titleWidth + 640))) : 2;
  const period = canvas.width / repeats;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = -1; i <= repeats; i++) {
    const x = canvas.width / 2 + i * period;
    ctx.font = '600 170px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillStyle = palette.text; ctx.fillText(title.toUpperCase(), x, 202);
    ctx.font = '500 92px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillStyle = palette.light; ctx.fillText(heading.toUpperCase(), x, 367);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
  return { texture, scrolling };
}

function HaloScene({ title, heading, palette }: Omit<Props, "theme"> & { palette: HaloPalette }) {
  const screen = useRef<Mesh>(null);
  const display = useMemo(() => createDisplay(title, heading, palette), [title, heading, palette]);
  useEffect(() => () => display?.texture.dispose(), [display]);
  useFrame(() => {
    if (screen.current) {
      // Global phase gives director/projector the same calm rotation, even after refresh.
      const phase = (Date.now() % 120000) / 120000;
      screen.current.rotation.y = -Math.PI + (display?.scrolling ? phase * Math.PI * 2 : 0);
    }
  });
  return <>
    <OrthographicCamera makeDefault manual position={[0, -4, 16]} left={-5.7} right={5.7} top={1.85} bottom={-1.85} near={.1} far={60} onUpdate={camera => { camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); }} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[-6, 7, 10]} intensity={3} color={palette.light} />
    <Suspense fallback={null}><Environment resolution={64} frames={1}>
      <Lightformer position={[0, 8, 6]} scale={[12, 3, 1]} intensity={3} color={palette.light} />
      <Lightformer position={[-6, 0, 4]} rotation-y={Math.PI / 3} scale={[3, 6, 1]} intensity={2} color={palette.metal} />
    </Environment></Suspense>
    <mesh ref={screen} rotation-y={-Math.PI}>
      <cylinderGeometry args={[4.6, 4.6, 1.15, 128, 1, true]} />
      <meshBasicMaterial map={display?.texture} color={display ? undefined : palette.surface} toneMapped={false} />
    </mesh>
    <mesh><cylinderGeometry args={[4.35, 4.35, 1.15, 96, 1, true]} /><meshStandardMaterial color={palette.shade} metalness={.8} roughness={.32} side={DoubleSide} /></mesh>
    {[-.62, .62].map(y => <group key={y} position-y={y}>
      <mesh rotation-x={Math.PI / 2}><torusGeometry args={[4.47, .16, 10, 128]} /><meshStandardMaterial color={palette.metal} metalness={.9} roughness={.2} /></mesh>
      <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[4.28, 4.63, 128]} /><meshStandardMaterial color={palette.shade} metalness={.75} roughness={.32} side={DoubleSide} /></mesh>
      <mesh position-y={y > 0 ? .025 : -.025} rotation-x={Math.PI / 2}><torusGeometry args={[4.6, .028, 6, 128]} /><meshBasicMaterial color={palette.light} toneMapped={false} /></mesh>
    </group>)}
    {Array.from({ length: 10 }, (_, index) => {
      const angle = index * Math.PI * 2 / 10;
      return <group key={index} position={[Math.sin(angle) * 4.43, -.75, Math.cos(angle) * 4.43]}>
        <mesh><cylinderGeometry args={[.12, .16, .22, 12]} /><meshStandardMaterial color={palette.shade} metalness={.8} roughness={.3} /></mesh>
        <mesh position-y={-.12} rotation-x={Math.PI / 2}><circleGeometry args={[.1, 16]} /><meshBasicMaterial color={palette.light} side={DoubleSide} toneMapped={false} /></mesh>
        <mesh position-y={-.34}><coneGeometry args={[.19, .4, 20, 1, true]} /><meshBasicMaterial color={palette.light} transparent opacity={.035} depthWrite={false} side={DoubleSide} /></mesh>
      </group>;
    })}
  </>;
}

export function DrawHalo({ title, heading, theme }: Props) {
  const host = useRef<HTMLElement>(null);
  const [palette, setPalette] = useState<HaloPalette | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void document.fonts.load('600 170px "Barlow Condensed"').then(() => { if (mounted) setFontsReady(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const css = getComputedStyle(host.current);
    const color = (token: string) => {
      const [h, s, l] = css.getPropertyValue(token).trim().split(/\s+/).map(parseFloat);
      return new Color().setHSL(h / 360, s / 100, l / 100, SRGBColorSpace).getStyle();
    };
    setPalette({ surface: color("--stage-led-surface"), dot: color("--stage-led-dot"), text: color("--primary"), metal: color("--stage-metal-main"), light: color("--stage-metal-light"), shade: color("--stage-metal-dark") });
  }, [theme]);
  return <header ref={host} className="draw-show-halo" role="img" aria-label={`${title} · ${heading}`} data-halo-title={title}>
    {palette && fontsReady && <Canvas dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}><HaloScene title={title} heading={heading} palette={palette} /></Canvas>}
  </header>;
}
